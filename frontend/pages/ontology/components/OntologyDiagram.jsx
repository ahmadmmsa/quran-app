import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useLanguage } from '../../../LanguageContext'
import OntologyNodePanel from './OntologyNodePanel'

// ---- persisted <-> react-flow conversion -------------------------------------
// Persisted article shape (kept for backward-compat + the editor's verse
// flattening): { type:'diagram', nodes:[{id,x,y,label,comment,verses}], links:[{id,from,to}] }

let _seq = 0
const newId = (prefix) => `${prefix}-${Date.now()}-${_seq++}`

function toReactFlow(data) {
  const article = data && data.type === 'diagram' ? data : null
  const rawNodes = article?.nodes?.length
    ? article.nodes
    : [{ id: 'node-1', x: 80, y: 80, label: 'Main concept', comment: '', verses: [] }]

  const nodes = rawNodes.map((n, i) => ({
    id: String(n.id || `node-${i}`),
    type: 'concept',
    position: { x: Number(n.x) || 0, y: Number(n.y) || 0 },
    data: { label: n.label || 'Untitled', comment: n.comment || '', verses: Array.isArray(n.verses) ? n.verses : [] },
  }))

  const edges = (article?.links || []).map((l, i) => ({
    id: String(l.id || `edge-${i}`),
    source: String(l.from),
    target: String(l.to),
  }))
  return { nodes, edges }
}

function toArticle(nodes, edges) {
  return {
    type: 'diagram',
    nodes: nodes.map((n) => ({
      id: n.id,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      label: n.data.label,
      comment: n.data.comment,
      verses: n.data.verses || [],
    })),
    links: edges.map((e) => ({ id: e.id, from: e.source, to: e.target })),
  }
}

// ---- custom node -------------------------------------------------------------
function ConceptNode({ data, selected }) {
  const { copy } = useLanguage()
  const verses = data.verses || []
  return (
    <div
      className="ontology-node"
      style={{
        width: 230,
        background: 'var(--color-bg-primary)',
        border: `1px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: selected ? '0 0 0 2px var(--color-accent)' : '0 1px 3px rgba(0,0,0,.12)',
        overflow: 'hidden',
      }}
    >
      {!data.readOnly && <Handle type="target" position={Position.Left} />}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 13 }}>
        {data.label || (copy.untitled || 'Untitled')}
      </div>
      <div style={{ padding: '8px 10px' }}>
        {data.comment ? (
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {data.comment}
          </p>
        ) : (
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>{copy.noNotes || 'No notes'}</p>
        )}
        {verses.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {verses.slice(0, 6).map((v, i) => (
              <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                {(v.surah_name || v.surah)}:{v.verse}
              </span>
            ))}
            {verses.length > 6 && <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>+{verses.length - 6}</span>}
          </div>
        )}
      </div>
      {!data.readOnly && <Handle type="source" position={Position.Right} />}
    </div>
  )
}

const nodeTypes = { concept: ConceptNode }

// ---- main --------------------------------------------------------------------
function Diagram({ data, onChange, readOnly = false }) {
  const { copy } = useLanguage()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedId, setSelectedId] = useState(null)
  const lastEmitted = useRef(null)

  // Initialize from external data; guard against our own echoed onChange.
  useEffect(() => {
    const sig = JSON.stringify(data ?? null)
    if (sig === lastEmitted.current) return
    const { nodes: n, edges: e } = toReactFlow(data)
    setNodes(n.map((nd) => ({ ...nd, data: { ...nd.data, readOnly } })))
    setEdges(e)
    lastEmitted.current = sig
  }, [data, readOnly, setNodes, setEdges])

  const emit = useCallback((nextNodes, nextEdges) => {
    if (readOnly) return
    const article = toArticle(nextNodes, nextEdges)
    lastEmitted.current = JSON.stringify(article)
    onChange?.(article)
  }, [onChange, readOnly])

  const onConnect = useCallback((params) => {
    setEdges((eds) => {
      const next = addEdge({ ...params, id: newId('edge') }, eds)
      setNodes((nds) => { emit(nds, next); return nds })
      return next
    })
  }, [setEdges, setNodes, emit])

  const onNodeDragStop = useCallback(() => {
    setNodes((nds) => { emit(nds, edges); return nds })
  }, [edges, emit, setNodes])

  const onEdgesDelete = useCallback(() => {
    // onEdgesChange already applied the removal; emit on next tick state.
    setEdges((eds) => { setNodes((nds) => { emit(nds, eds); return nds }); return eds })
  }, [emit, setEdges, setNodes])

  const addNode = useCallback(() => {
    setNodes((nds) => {
      const node = {
        id: newId('node'),
        type: 'concept',
        position: { x: 120 + nds.length * 30, y: 120 + nds.length * 30 },
        data: { label: copy.newConcept || 'New concept', comment: '', verses: [], readOnly },
      }
      const next = [...nds, node]
      setEdges((eds) => { emit(next, eds); return eds })
      setSelectedId(node.id)
      return next
    })
  }, [emit, readOnly, setNodes, setEdges])

  const updateNode = useCallback((id, patch) => {
    setNodes((nds) => {
      const next = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
      setEdges((eds) => { emit(next, eds); return eds })
      return next
    })
  }, [emit, setNodes, setEdges])

  const deleteNode = useCallback((id) => {
    setNodes((nds) => {
      const nextNodes = nds.filter((n) => n.id !== id)
      setEdges((eds) => {
        const nextEdges = eds.filter((e) => e.source !== id && e.target !== id)
        emit(nextNodes, nextEdges)
        return nextEdges
      })
      return nextNodes
    })
    setSelectedId(null)
  }, [emit, setNodes, setEdges])

  const selectedNode = nodes.find((n) => n.id === selectedId) || null

  return (
    <div style={{ display: 'flex', gap: 12, height: '70vh', minHeight: 460 }}>
      <div style={{ flex: 1, position: 'relative', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {!readOnly && (
          <button
            onClick={addNode}
            style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, padding: '6px 12px', fontSize: 13 }}
          >
            + {copy.add || 'Add'} node
          </button>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          onSelectionChange={({ nodes: sel }) => setSelectedId(sel?.[0]?.id ?? null)}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      {!readOnly && selectedNode && (
        <OntologyNodePanel
          node={selectedNode}
          onChange={(patch) => updateNode(selectedNode.id, patch)}
          onDelete={() => deleteNode(selectedNode.id)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

export default function OntologyDiagram(props) {
  return (
    <ReactFlowProvider>
      <Diagram {...props} />
    </ReactFlowProvider>
  )
}

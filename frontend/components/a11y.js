// Make a non-button element behave like a button for keyboard + screen-reader users.
export const clickableProps = (handler) => ({
  role: 'button',
  tabIndex: 0,
  onClick: handler,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler(e)
    }
  },
})

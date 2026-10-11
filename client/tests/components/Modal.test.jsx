import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Modal from '../../src/components/Modal'

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ userSettings: {} }),
}))

function ModalHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </Modal>
      )}
    </>
  )
}

function NestedModalHarness() {
  const [outerOpen, setOuterOpen] = useState(false)
  const [innerOpen, setInnerOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOuterOpen(true)}>Open outer</button>
      {outerOpen && (
        <Modal onClose={() => setOuterOpen(false)}>
          <button type="button" onClick={() => setInnerOpen(true)}>Open inner</button>
          {innerOpen && <Modal onClose={() => setInnerOpen(false)}><button type="button">Inner action</button></Modal>}
        </Modal>
      )}
    </>
  )
}

describe('Modal keyboard flow', () => {
  it('moves focus into the modal and traps Tab at the end', () => {
    render(<ModalHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))

    const firstAction = screen.getByRole('button', { name: 'First action' })
    const lastAction = screen.getByRole('button', { name: 'Last action' })
    expect(firstAction.parentElement.parentElement).toBe(document.body)
    expect(firstAction).toHaveFocus()

    lastAction.focus()
    fireEvent.keyDown(lastAction, { key: 'Tab' })
    expect(firstAction).toHaveFocus()
  })

  it('closes on Escape and restores focus to the opener', () => {
    render(<ModalHarness />)
    const opener = screen.getByRole('button', { name: 'Open dialog' })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'First action' })).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes only the top modal when dialogs are nested', () => {
    render(<NestedModalHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open outer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open inner' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'Inner action' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open inner' })).toBeInTheDocument()
  })
})
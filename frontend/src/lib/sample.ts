/** Draws a BMTC-style LED bus board on a canvas and returns it as a JPEG file.
 *  Lets judges try Lipi Lens without a photo; the layout matches the backend's demo result. */
export async function makeSampleBusBoard(): Promise<File> {
  const W = 1600
  const H = 900
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  try {
    await document.fonts.load('700 120px "Noto Sans Kannada"')
  } catch {
    /* falls back to a system Kannada font */
  }

  // Bus body + board housing
  g.fillStyle = '#1d4e89'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#0b0b0c'
  g.beginPath()
  g.roundRect(60, 90, W - 120, 470, 28)
  g.fill()

  // LED dot texture
  g.fillStyle = 'rgba(255,255,255,0.035)'
  for (let y = 110; y < 545; y += 9) for (let x = 80; x < W - 80; x += 9) g.fillRect(x, y, 3, 3)

  const led = (text: string, x: number, y: number, size: number, maxW: number) => {
    g.font = `700 ${size}px "Noto Sans Kannada", "Nirmala UI", sans-serif`
    g.shadowColor = 'rgba(255, 176, 32, 0.9)'
    g.shadowBlur = 24
    g.fillStyle = '#ffb020'
    g.textBaseline = 'middle'
    g.fillText(text, x, y, maxW)
    g.shadowBlur = 0
  }
  led('252', 120, 270, 190, 250)
  led('ಮೆಜೆಸ್ಟಿಕ್', 470, 225, 150, 1000)
  led('ಮಲ್ಲೇಶ್ವರಂ ಮಾರ್ಗವಾಗಿ', 470, 440, 105, 1000)

  // Windscreen hint below
  g.fillStyle = '#7fb2d9'
  g.fillRect(60, 620, W - 120, 280)
  g.fillStyle = 'rgba(255,255,255,0.25)'
  g.fillRect(60, 620, W - 120, 30)

  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92))
  return new File([blob], 'sample-bus-board.jpg', { type: 'image/jpeg' })
}

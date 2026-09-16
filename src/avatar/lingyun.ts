export interface AvatarFrame {
  key: string
  frame: number
  src: string
  angle?: number
}

const base = '/profiles/lingyun/avatar/angle-frames'

export const lingyunAvatar = {
  centerDeadZone: 0.13,
  center: { key: 'center', frame: 121, src: `${base}/center.png` },
  directions: [
    { key: 'e', angle: 0, frame: 44, src: `${base}/e.png` },
    { key: 'ese', angle: 22.5, frame: 48, src: `${base}/ese.png` },
    { key: 'se', angle: 45, frame: 53, src: `${base}/se.png` },
    { key: 'sse', angle: 67.5, frame: 57, src: `${base}/sse.png` },
    { key: 's', angle: 90, frame: 61, src: `${base}/s.png` },
    { key: 'ssw', angle: 112.5, frame: 66, src: `${base}/ssw.png` },
    { key: 'sw', angle: 135, frame: 72, src: `${base}/sw.png` },
    { key: 'wsw', angle: 157.5, frame: 75, src: `${base}/wsw.png` },
    { key: 'w', angle: 180, frame: 78, src: `${base}/w.png` },
    { key: 'wnw', angle: 202.5, frame: 85, src: `${base}/wnw.png` },
    { key: 'nw', angle: 225, frame: 93, src: `${base}/nw.png` },
    { key: 'nnw', angle: 247.5, frame: 100, src: `${base}/nnw.png` },
    { key: 'n', angle: 270, frame: 106, src: `${base}/n.png` },
    { key: 'nne', angle: 292.5, frame: 18, src: `${base}/nne.png` },
    { key: 'ne', angle: 315, frame: 30, src: `${base}/ne.png` },
    { key: 'ene', angle: 337.5, frame: 38, src: `${base}/ene.png` },
  ] satisfies AvatarFrame[],
}

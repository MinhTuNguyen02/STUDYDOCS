import { FiStar } from 'react-icons/fi'

interface Props {
  rating: number // 0 to 5
  size?: number
  color?: string
}

export default function ReviewStars({ rating, size = 16, color = '#FDCB6E' }: Props) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <FiStar
        key={i}
        size={size}
        fill={i <= rating ? color : 'transparent'}
        color={i <= rating ? color : '#D1D5DB'}
        style={{ marginRight: 2 }}
      />
    )
  }

  return <div style={{ display: 'inline-flex', alignItems: 'center' }}>{stars}</div>
}

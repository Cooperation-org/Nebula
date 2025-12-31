'use client'

import dynamic from 'next/dynamic'

const BoardView = dynamic(() => import('./BoardView'), { ssr: false })

export default function BoardPage() {
  return <BoardView />
}

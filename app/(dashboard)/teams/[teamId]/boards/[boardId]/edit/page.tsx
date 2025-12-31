'use client'

import dynamic from 'next/dynamic'

const EditBoardForm = dynamic(() => import('./EditBoardForm'), { ssr: false })

export default function EditBoardPage() {
  return <EditBoardForm />
}

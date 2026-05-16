import { Suspense, lazy } from 'react'

const LifeMap = lazy(() => import('./LifeMap'))

function App() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading mind map...</div>}>
      <LifeMap />
    </Suspense>
  )
}

export default App

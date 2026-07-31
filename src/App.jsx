import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import PainelAdministrador from './PainelAdministrador'

function App() {
  const [session, setSession] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsCheckingSession(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (isCheckingSession) {
    return <p>Carregando...</p>
  }

  if (!session) {
    return <Login />
  }

  return <PainelAdministrador session={session} onLogout={handleLogout} />
}

export default App

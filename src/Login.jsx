import { useState } from 'react'
import { supabase } from './supabaseClient'
import logoSemane from './assets/semane-logo.png'
import './Login.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
    }

    setIsSubmitting(false)
  }

  return (
    <section className="login-page">
      <div className="login-cartao">
        <div className="login-topo">
          <img src={logoSemane} alt="SEMANE" className="login-logo" />
          <h1 className="login-nome">SEMANE</h1>
          <p className="login-descricao">Gestão de multipropriedades em resorts</p>
          <p className="login-saudacao">Seja bem-vindo!</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="login-campo">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="nome@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="login-campo">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <p className="login-erro">{error}</p>}
          <button type="submit" className="login-botao" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </section>
  )
}

export default Login

import { useState } from 'react'
import { supabase } from './supabaseClient'
import logoSemane from './assets/semane-logo.png'
import './Login.css'

const EMAILS_LEMBRADOS_KEY = 'semane_login_emails'
const EMAIL_LEMBRADO_KEY_ANTIGA = 'semane_login_email'
const MAX_EMAILS_LEMBRADOS = 20

function lerEmailsLembrados() {
  try {
    const salvos = JSON.parse(localStorage.getItem(EMAILS_LEMBRADOS_KEY))
    if (Array.isArray(salvos)) return salvos.filter((item) => typeof item === 'string' && item)
  } catch {
    // ignora valor corrompido e recomeça a lista
  }

  const emailAntigo = localStorage.getItem(EMAIL_LEMBRADO_KEY_ANTIGA)
  return emailAntigo ? [emailAntigo] : []
}

function guardarEmailLembrado(email, emailsAtuais) {
  const lista = [email, ...emailsAtuais.filter((item) => item !== email)].slice(0, MAX_EMAILS_LEMBRADOS)
  localStorage.setItem(EMAILS_LEMBRADOS_KEY, JSON.stringify(lista))
  localStorage.removeItem(EMAIL_LEMBRADO_KEY_ANTIGA)
  return lista
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailsSugeridos, setEmailsSugeridos] = useState(() => lerEmailsLembrados())

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha incorretos.')
    } else {
      setEmailsSugeridos(guardarEmailLembrado(email, emailsSugeridos))
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
              autoComplete="username"
              list="emails-sugeridos"
              required
            />
            <datalist id="emails-sugeridos">
              {emailsSugeridos.map((emailSugerido) => (
                <option key={emailSugerido} value={emailSugerido} />
              ))}
            </datalist>
          </div>
          <div className="login-campo">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
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

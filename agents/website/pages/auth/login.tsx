export default function Login() {
  return (
    <div style={{padding: 40}}>
      <h1>Login Page</h1>
      <input data-testid="email" placeholder="Email" />
      <input data-testid="password" type="password" placeholder="Password" />
      <button data-testid="login-button">Login</button>
      <div data-testid="error">Invalid credentials</div>
    </div>
  )
}

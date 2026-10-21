export default function Home() {
  return (
    <main style={{padding: '40px', fontFamily: 'sans-serif'}}>
      <h1>My Website</h1>
      <p>Clean website - No Playwright, No CheckDiff yet</p>
      <nav>
        <ul>
          <li><a href="/checkout">Go to Checkout</a></li>
          <li><a href="/auth/login">Go to Login</a></li>
          <li><a href="/product/123">Go to Product</a></li>
        </ul>
      </nav>
      <div style={{marginTop: 20, padding: 10, background: '#f0f0f0'}}>
        API Status: <span id="api-status">checking...</span>
      </div>
      <script dangerouslySetInnerHTML={{__html: `
        fetch('http://localhost:4000/health').then(r=>r.json()).then(d=>{
          document.getElementById('api-status').innerText = d.status + ' - API connected'
        }).catch(()=> {
          document.getElementById('api-status').innerText = 'API offline - start api agent'
        })
      `}} />
    </main>
  )
}

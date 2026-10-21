export default function Checkout() {
  return (
    <div style={{padding: 40}}>
      <h1>Checkout Page</h1>
      <div data-testid="cart-summary">Cart: 2 items - $199</div>
      <input data-testid="coupon-input" placeholder="Enter coupon" />
      <button data-testid="apply-coupon">Apply Coupon</button>
      <div data-testid="discount">Discount applied!</div>
      <hr style={{margin: '20px 0'}} />
      <input data-testid="email" placeholder="Enter email" />
      <button data-testid="place-order">Place Order</button>
    </div>
  )
}

import { useRouter } from 'next/router'
export default function Product() {
  const router = useRouter()
  return (
    <div style={{padding: 40}}>
      <h1>Product {router.query.id}</h1>
      <button data-testid="add-to-cart">Add to Cart</button>
    </div>
  )
}

import fs from 'fs';

async function seedProducts() {
  const dummySvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <rect width="100%" height="100%" fill="#f5f6f8"/>
      <circle cx="150" cy="150" r="45" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="2"/>
      <path d="M130 180 L150 120 L170 180 Z" fill="#94a3b8"/>
    </svg>`
  );

  const items = [
    { title: 'Eiffel Tower Metal Art', price: 90, stock: 10 },
    { title: 'Minimalist Dining Chair', price: 60, stock: 8 },
    { title: 'Vintage Hanging Lamp', price: 130, stock: 5 },
    { title: 'Studio Armchair', price: 56.20, stock: 12 },
    { title: 'Ribbon Leather Bag', price: 60, stock: 4 },
    { title: 'Classic Low Sneaker', price: 30, stock: 15 },
    { title: 'Partex Special Chair', price: 85, stock: 6 },
    { title: 'Partex Wooden Table', price: 100, stock: 3 }
  ];

  for (const item of items) {
    const form = new FormData();
    form.append('title', item.title);
    form.append('price', item.price.toString());
    form.append('stock', item.stock.toString());
    form.append('photo', new Blob([dummySvg], { type: 'image/svg+xml' }), 'product.svg');

    const res = await fetch('http://localhost:3000/api/admin/products', {
      method: 'POST',
      headers: { 'x-admin-token': 'admin123' },
      body: form
    });
    const data = await res.json();
    console.log('Created product:', data.product?.title);
  }
}

seedProducts().catch(console.error);

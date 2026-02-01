import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsAPI } from '../api/api';
import { useAuthStore, useCartStore } from '../store/store';
import { ShoppingCart, ArrowLeft } from 'lucide-react';

export default function ProductsPage() {
  const { user } = useAuthStore();
  const { items, addItem } = useCartStore();
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productsAPI.getAll();
      return response.data;
    },
  });

  const handleAddToCart = (product, termMonths, price) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    addItem({
      product_id: product.id,
      product_name: product.name,
      term_months: termMonths,
      price: price,
      account_type: product.account_type,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </Link>
            {items.length > 0 && (
              <Link
                to="/checkout"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <ShoppingCart className="w-5 h-5" />
                Cart ({items.length})
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">All Products</h1>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products?.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductCard({ product, onAddToCart }) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <h3 className="text-2xl font-bold mb-2">{product.name}</h3>
        <p className="text-blue-100">{product.description}</p>
      </div>
      <div className="p-6">
        {product.account_type === 'subscriber' && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">Max Connections: {product.max_connections}</p>
          </div>
        )}
        {product.account_type === 'reseller' && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">Credits: ${product.reseller_credits}</p>
            <p className="text-sm text-gray-600">Max Lines: {product.reseller_max_lines}</p>
          </div>
        )}
        <div className="space-y-3">
          {Object.entries(product.prices).map(([term, price]) => (
            <button
              key={term}
              onClick={() => onAddToCart(product, parseInt(term), price)}
              className="w-full flex justify-between items-center bg-gray-50 hover:bg-blue-50 p-4 rounded-lg transition border border-gray-200 hover:border-blue-300"
            >
              <span className="font-semibold">{term} {parseInt(term) === 1 ? 'Month' : 'Months'}</span>
              <span className="text-2xl font-bold text-blue-600">${price}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

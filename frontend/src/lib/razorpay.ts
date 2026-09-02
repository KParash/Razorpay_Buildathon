declare global {
  interface Window {
    Razorpay: any;
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(orderData: {
  id: string;
  amount: number;
  currency: string;
  razorpay_key_id?: string;
  is_mock?: boolean;
  onSuccess?: (paymentRes: any) => void;
}) {
  const loaded = await loadRazorpayScript();
  if (!loaded && !orderData.is_mock) {
    alert('Failed to load Razorpay SDK. Please check your internet connection.');
    return;
  }

  if (orderData.is_mock || !window.Razorpay) {
    // Simulated Razorpay success for local dev / mock mode
    const mockResponse = {
      razorpay_order_id: orderData.id,
      razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 10)}`,
      razorpay_signature: 'mock_signature_verified',
    };
    alert(`🎉 MOCK PAYMENT SUCCESSFUL!\nOrder ID: ${orderData.id}\nAmount: ₹${(orderData.amount / 100).toFixed(2)}`);
    if (orderData.onSuccess) orderData.onSuccess(mockResponse);
    return;
  }

  const options = {
    key: orderData.razorpay_key_id || 'rzp_test_MOCK',
    amount: orderData.amount,
    currency: orderData.currency || 'INR',
    name: 'AURA AI Fashion Store',
    description: 'Personalized Outfit Checkout',
    order_id: orderData.id,
    handler: function (response: any) {
      alert(`✅ Payment Successful!\nPayment ID: ${response.razorpay_payment_id}`);
      if (orderData.onSuccess) orderData.onSuccess(response);
    },
    prefill: {
      name: 'Guest User',
      email: 'customer@example.com',
      contact: '9999999999',
    },
    theme: {
      color: '#9333ea',
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}

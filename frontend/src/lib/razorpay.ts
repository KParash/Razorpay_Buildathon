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
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  onSuccess?: (paymentRes: any) => void;
  onError?: (error: any) => void;
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
    name: 'KAZU/STYLO',
    description: 'Personalized Outfit Checkout',
    order_id: orderData.id,
    handler: async function (response: any) {
      try {
        // Cryptographically verify payment on the backend
        const verifyRes = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.status === 'success') {
          if (orderData.onSuccess) orderData.onSuccess(response);
        } else {
          alert(`Payment signature verification failed: ${verifyData.detail || 'Security check rejected'}`);
          if (orderData.onError) orderData.onError(verifyData);
        }
      } catch (err: any) {
        console.error('Error verifying payment:', err);
        alert('Payment verification could not be completed with server.');
        if (orderData.onError) orderData.onError(err);
      }
    },
    prefill: {
      name: orderData.prefill?.name || 'Guest User',
      email: orderData.prefill?.email || '',
      contact: orderData.prefill?.contact || '',
    },
    theme: {
      color: '#9333ea',
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
}


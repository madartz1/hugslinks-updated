// HUGSLinks Printify connection diagnostic
// Uses PRINTIFY_API_TOKEN from Netlify environment variables.
// Read-only: this function does not create, update, or submit orders.

const API = "https://api.printify.com/v1";

async function printify(path, token) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "HUGSLinks/1.0"
    }
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(`Printify API returned ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

export async function handler() {
  const token = process.env.PRINTIFY_API_TOKEN;

  if (!token) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "PRINTIFY_API_TOKEN is not configured in this deploy context."
      })
    };
  }

  try {
    const shops = await printify("/shops.json", token);
    const results = [];

    for (const shop of shops) {
      let products = [];
      try {
        const productResponse = await printify(
          `/shops/${encodeURIComponent(shop.id)}/products.json?limit=50`,
          token
        );

        const items = Array.isArray(productResponse)
          ? productResponse
          : (productResponse && Array.isArray(productResponse.data) ? productResponse.data : []);

        products = items.map((product) => ({
          product_id: product.id,
          id: product.id,
          title: product.title,
          visible: product.visible,
          variants: Array.isArray(product.variants)
            ? product.variants.map((variant) => ({
                variant_id: variant.id,
                id: variant.id,
                title: variant.title,
                sku: variant.sku,
                price: variant.price,
                is_enabled: variant.is_enabled,
                is_available: variant.is_available
              }))
            : []
        }));
      } catch (error) {
        products = [{
          error: "Could not read products for this shop.",
          status: error.status || 500,
          details: error.details || null
        }];
      }

      results.push({
        shop_id: shop.id,
        shop_title: shop.title,
        sales_channel: shop.sales_channel,
        products
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        ok: true,
        token_exposed: false,
        note: "Use product_id for the product and variant_id for the exact enabled variant when configuring fulfillment.",
        shops: results
      }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: error.status || 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        ok: false,
        error: error.message,
        details: error.details || null
      }, null, 2)
    };
  }
};

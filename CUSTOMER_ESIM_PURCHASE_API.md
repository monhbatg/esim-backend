# Customer eSIM Purchase API Integration Guide

This documentation outlines how to integrate the Customer eSIM Purchase flow into your frontend application. This flow allows users to purchase an eSIM package without creating a full account (guest/customer checkout).

## 1. API Endpoint

### Initiate Purchase

**URL**: `/api/customer/transactions/purchase` (Adjust base URL as per your environment)
**Method**: `POST`
**Content-Type**: `application/json`

### Request Body

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `phoneNumber` | string | Yes | User's phone number (used as identifier) | `"99112233"` |
| `email` | string | Yes | User's email for notifications | `"customer@example.com"` |
| `amount` | number | Yes | Total amount to charge (in MNT) | `5000` |
| `packageCode` | string | Yes | The eSIM package code being purchased | `"JC053"` |
| `description` | string | No | Optional transaction description | `"eSIM Purchase"` |

**Example Request:**

```json
{
  "phoneNumber": "99112233",
  "email": "customer@example.com",
  "amount": 15000,
  "packageCode": "JC053",
  "description": "Travel eSIM 1GB"
}
```

### Response Body

The API returns the QPay invoice data necessary to display the payment QR code or redirect the user.

| Field | Type | Description |
|---|---|---|
| `invoice_id` | string | The unique QPay invoice ID |
| `qr_image` | string | Base64 encoded string of the QR code image (display as `data:image/png;base64,...`) |
| `qr_link` | string | Deep link for mobile app redirection (e.g., `qpay://...`) |
| `customerId` | string | Internal ID of the created/found customer |
| `internalInvoiceId` | string | Internal ID of the invoice record |

**Example Response:**

```json
{
  "invoice_id": "64a1b2c3-d4e5-...",
  "qr_image": "iVBORw0KGgoAAAANSUhEUg...", 
  "qr_link": "https://qpay.mn/p/...",
  "customerId": "uuid-string",
  "internalInvoiceId": "uuid-string"
}
```

---

## 2. Integration Flow

### Step 1: Collect User Information
Create a form to collect the required details from the user:
- Phone Number
- Email
- Select eSIM Package (which gives you the `packageCode` and `amount`)

### Step 2: Call Purchase Endpoint
Send the data to the `POST /customer/transactions/purchase` endpoint.

### Step 3: Display Payment Options
Handle the response to show payment interfaces:

**Desktop Users:**
- Render the `qr_image` as an image source:
  `<img src={"data:image/png;base64," + response.qr_image} alt="QPay QR" />`

**Mobile Users:**
- Use the `qr_link` to redirect the user to their banking app or show a list of available banks supported by QPay.

### Step 4: Payment Verification (Callback)
The backend is configured with a `callback_url` that QPay will call upon successful payment. 

*Note: If you need to poll for payment status from the frontend (e.g., "Waiting for payment..." spinner), you may need to implement a status check loop. Ensure you have access to a public status endpoint if the user is not logged in.*

## 3. Error Handling

Handle common HTTP status codes:
- **201 Created**: Success.
- **400 Bad Request**: Invalid input (e.g., missing fields, invalid email).
- **500 Internal Server Error**: Payment provider connection failed.


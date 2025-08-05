# Accounts Payable API Tools

This document describes the Accounts Payable API tools that have been added to the MCP server based on Workday's Accounts Payable v1 API specification.

## Available Tools

### 1. `get_supplier_invoice_requests`
**Description:** Retrieve a collection of supplier invoice requests with optional filters

**Parameters:**
- `company` (array, optional): Company IDs for filtering
- `fromDueDate` (string, optional): Beginning date of payment due period (MM/DD/YYYY format)
- `fromInvoiceDate` (string, optional): Date on or after which invoice is created (MM/DD/YYYY format)
- `limit` (number, optional): Maximum number of results (default: 20, max: 100)
- `offset` (number, optional): Zero-based index for pagination (default: 0)
- `requester` (array, optional): Worker IDs of requesters for filtering
- `status` (array, optional): Status values for filtering
- `supplier` (array, optional): Supplier IDs for filtering
- `toDueDate` (string, optional): End date of payment due period (MM/DD/YYYY format)
- `toInvoiceDate` (string, optional): Date on or before which invoice is created (MM/DD/YYYY format)

### 2. `get_supplier_invoice_request`
**Description:** Retrieve a specific supplier invoice request by ID

**Parameters:**
- `invoiceId` (string, required): The Workday ID of the supplier invoice request

### 3. `create_supplier_invoice_request`
**Description:** Create a new supplier invoice request

**Required Parameters:**
- `company` (string): Company ID
- `supplier` (string): Supplier ID
- `invoiceDate` (string): Invoice date in YYYY-MM-DD format

**Optional Parameters:**
- `currency` (string): Currency ID
- `taxAmount` (number): Tax amount for the invoice
- `requester` (string): Requester worker ID
- `controlTotalAmount` (number): Control total amount that should match line amounts
- `referenceType` (string): Reference type ID
- `paymentTerms` (string): Payment terms ID
- `statutoryInvoiceType` (string): Statutory invoice type ID
- `suppliersInvoiceNumber` (string): Supplier's invoice number
- `referenceNumber` (string): Reference number with key payment information
- `invoiceReceivedDate` (string): Date invoice was received in YYYY-MM-DD format
- `freightAmount` (number): Freight amount
- `handlingCode` (string): Handling code ID
- `shipToAddress` (string): Ship to address ID
- `memo` (string): Memo for the invoice request
- `remitToConnection` (string): Remit to connection ID

### 4. `submit_supplier_invoice_request`
**Description:** Submit a supplier invoice request for approval

**Parameters:**
- `invoiceId` (string, required): The Workday ID of the supplier invoice request to submit

### 5. `get_supplier_invoice_request_lines`
**Description:** Retrieve lines for a specific supplier invoice request

**Parameters:**
- `invoiceId` (string, required): The Workday ID of the supplier invoice request
- `limit` (number, optional): Maximum number of results (default: 20, max: 100)
- `offset` (number, optional): Zero-based index for pagination (default: 0)

### 6. `get_supplier_invoice_request_line`
**Description:** Retrieve a specific line from a supplier invoice request

**Parameters:**
- `invoiceId` (string, required): The Workday ID of the supplier invoice request
- `lineId` (string, required): The Workday ID of the specific line

### 7. `get_supplier_invoice_request_attachments`
**Description:** Retrieve attachments for a specific supplier invoice request

**Parameters:**
- `invoiceId` (string, required): The Workday ID of the supplier invoice request
- `limit` (number, optional): Maximum number of results (default: 20, max: 100)
- `offset` (number, optional): Zero-based index for pagination (default: 0)

### 8. `get_supplier_invoice_request_attachment`
**Description:** Retrieve a specific attachment from a supplier invoice request

**Parameters:**
- `invoiceId` (string, required): The Workday ID of the supplier invoice request
- `attachmentId` (string, required): The Workday ID of the specific attachment

### 9. `create_supplier_invoice_request_attachment`
**Description:** Create a new attachment for a supplier invoice request

**Parameters:**
- `invoiceId` (string, required): The Workday ID of the supplier invoice request
- `fileName` (string, required): Name of the file to attach
- `contentType` (string, optional): Content type ID for the attachment
- `fileLength` (number, optional): Length of the file in bytes

## API Details

- **Base Path:** `/accountsPayable/v1`
- **Authentication:** Uses OAuth 2.0 Bearer tokens (managed automatically by the MCP server)
- **Content Type:** `application/json`
- **Scope:** Supplier Accounts

## Security Requirements

All endpoints require appropriate Workday permissions:
- **Process:** Supplier Invoice - Request
- **View:** Supplier Invoice Request (for read operations)
- **Self-Service:** Supplier Invoice Request (for some read operations)

## Error Handling

The tools handle standard HTTP error codes:
- `400`: Invalid request
- `401`: Invalid resource or operation
- `403`: User has insufficient permissions
- `404`: Resource not found

## Implementation Notes

- All tools are implemented in `src/accounts-payable-api.ts`
- Tool definitions are in the `ACCOUNTS_PAYABLE_TOOLS` array in `src/index.ts`
- String IDs are automatically converted to the required `{id: "value"}` format for the Workday API
- Responses are formatted with appropriate emojis and JSON formatting for readability

## Examples

### List recent supplier invoice requests:
```javascript
{
  "name": "get_supplier_invoice_requests",
  "arguments": {
    "limit": 10,
    "fromInvoiceDate": "01/01/2024"
  }
}
```

### Create a new supplier invoice request:
```javascript
{
  "name": "create_supplier_invoice_request", 
  "arguments": {
    "company": "COMPANY_ID",
    "supplier": "SUPPLIER_ID",
    "invoiceDate": "2024-01-15",
    "suppliersInvoiceNumber": "INV-2024-001",
    "memo": "Monthly services invoice"
  }
}
``` 
import * as https from 'https';

interface WorkdayConfig {
  baseUrl: string;
  tenant: string;
  getAccessToken: () => Promise<string>;
}

// Helper function to make HTTP requests
function makeHttpRequest(options: any, body?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = res.statusCode === 204 ? {} : JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Get supplier invoice requests
export async function getSupplierInvoiceRequests(
  config: WorkdayConfig,
  params: {
    company?: string[];
    fromDueDate?: string;
    fromInvoiceDate?: string;
    limit?: number;
    offset?: number;
    requester?: string[];
    status?: string[];
    supplier?: string[];
    toDueDate?: string;
    toInvoiceDate?: string;
  } = {}
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = new URL(`${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, value.toString());
      }
    }
  });

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Get a specific supplier invoice request
export async function getSupplierInvoiceRequest(
  config: WorkdayConfig,
  invoiceId: string
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Create a new supplier invoice request
export async function createSupplierInvoiceRequest(
  config: WorkdayConfig,
  invoiceData: {
    company: { id: string };
    currency?: { id: string };
    taxAmount?: number;
    requester?: { id: string };
    controlTotalAmount?: number;
    referenceType?: { id: string };
    paymentTerms?: { id: string };
    lines?: any[];
    statutoryInvoiceType?: { id: string };
    suppliersInvoiceNumber?: string;
    referenceNumber?: string;
    invoiceReceivedDate?: string;
    freightAmount?: number;
    supplier: { id: string };
    handlingCode?: { id: string };
    shipToAddress?: { id: string };
    invoiceDate: string;
    memo?: string;
    remitToConnection?: { id: string };
  }
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  return makeHttpRequest(options, JSON.stringify(invoiceData));
}

// Submit a supplier invoice request
export async function submitSupplierInvoiceRequest(
  config: WorkdayConfig,
  invoiceId: string,
  submitData: any = {}
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/submit`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  return makeHttpRequest(options, JSON.stringify(submitData));
}

// Get supplier invoice request lines
export async function getSupplierInvoiceRequestLines(
  config: WorkdayConfig,
  invoiceId: string,
  params: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = new URL(`${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/lines`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Get a specific supplier invoice request line
export async function getSupplierInvoiceRequestLine(
  config: WorkdayConfig,
  invoiceId: string,
  lineId: string
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/lines/${lineId}`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Get supplier invoice request attachments
export async function getSupplierInvoiceRequestAttachments(
  config: WorkdayConfig,
  invoiceId: string,
  params: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = new URL(`${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/attachments`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Get a specific supplier invoice request attachment
export async function getSupplierInvoiceRequestAttachment(
  config: WorkdayConfig,
  invoiceId: string,
  attachmentId: string
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/attachments/${attachmentId}`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Create an attachment for supplier invoice request
export async function createSupplierInvoiceRequestAttachment(
  config: WorkdayConfig,
  invoiceId: string,
  attachmentData: {
    fileLength?: number;
    contentType?: { id: string };
    fileName?: string;
  }
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/attachments`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };

  return makeHttpRequest(options, JSON.stringify(attachmentData));
}

// Get attachment content
export async function getSupplierInvoiceRequestAttachmentContent(
  config: WorkdayConfig,
  invoiceId: string,
  attachmentId: string,
  params: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = new URL(`${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/attachments?type=viewContent`);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
}

// Get specific attachment content
export async function getSpecificSupplierInvoiceRequestAttachmentContent(
  config: WorkdayConfig,
  invoiceId: string,
  attachmentId: string
): Promise<any> {
  const accessToken = await config.getAccessToken();
  const url = `${config.baseUrl}/accountsPayable/v1/supplierInvoiceRequests/${invoiceId}/attachments/${attachmentId}?type=viewContent`;

  const options = {
    hostname: new URL(url).hostname,
    port: 443,
    path: new URL(url).pathname + new URL(url).search,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    }
  };

  return makeHttpRequest(options);
} 
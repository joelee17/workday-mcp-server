import * as https from 'https';

// Configuration interface for Learning APIs
interface WorkdayConfig {
  baseUrl: string;
  tenant: string;
  getAccessToken: () => Promise<string>; // Changed from bearerToken to getAccessToken function
}

// Standard response interface for Learning APIs
interface LearningResponse {
  data?: any[];
  total?: number;
  paging?: {
    page: number;
    size: number;
    totalPages: number;
  };
}

// Learning content interface
interface LearningContent {
  id: string;
  title: string;
  type: string;
  description?: string;
  duration?: number;
  language?: string;
  tags?: string[];
  difficulty?: string;
  provider?: string;
  url?: string;
}

// Learning enrollment interface  
interface LearningEnrollment {
  id: string;
  workerId: string;
  contentId: string;
  status: string;
  enrollmentDate: string;
  completionDate?: string;
  progress?: number;
}

// REST API helper function
async function makeWorkdayRequest(
  config: WorkdayConfig,
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const accessToken = await config.getAccessToken();
  
  return new Promise((resolve, reject) => {
    const url = `${config.baseUrl}${endpoint}`;
    const headers: any = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const bodyString = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(bodyString).toString();
    }

    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + (new URL(url).search || ''),
      method: method,
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`Workday Learning API error (${res.statusCode}): ${response.error || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Workday Learning response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Workday Learning API request error: ${error.message}`));
    });

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Learning Content Enrollment Functions

/**
 * Enroll a worker in learning content
 * Based on Workday Learning API Enroll_In_Learning_Content_Request
 */
export async function enrollInLearningContent(
  config: WorkdayConfig,
  enrollmentData: {
    workerId: string;
    learningContentId: string;
    enrollmentDate?: string;
    dueDate?: string;
    comment?: string;
    autoEnroll?: boolean;
    sendNotification?: boolean;
    assignmentReason?: string;
    priority?: 'High' | 'Medium' | 'Low';
  }
): Promise<any> {
  const path = `/ccx/api/v1/${config.tenant}/learningEnrollments`;
  
  // Construct enrollment payload based on Workday Learning API structure
  const payload = {
    worker: {
      id: enrollmentData.workerId
    },
    learningContent: {
      id: enrollmentData.learningContentId
    },
    enrollmentDate: enrollmentData.enrollmentDate || new Date().toISOString().split('T')[0],
    dueDate: enrollmentData.dueDate,
    comment: enrollmentData.comment,
    autoEnroll: enrollmentData.autoEnroll !== false, // Default to true
    sendNotification: enrollmentData.sendNotification !== false, // Default to true
    assignmentReason: enrollmentData.assignmentReason || 'Manager Assignment',
    priority: enrollmentData.priority || 'Medium'
  };

  // Remove undefined fields
  Object.keys(payload).forEach(key => {
    if (payload[key as keyof typeof payload] === undefined) {
      delete payload[key as keyof typeof payload];
    }
  });

  return makeWorkdayRequest(config, 'POST', path, payload);
}

/**
 * Get learning enrollments for a worker
 */
export async function getWorkerLearningEnrollments(
  config: WorkdayConfig,
  workerId: string,
  limit?: number,
  offset?: number
): Promise<any> {
  let path = `/ccx/api/v1/${config.tenant}/workers/${workerId}/learningEnrollments`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

/**
 * Get available learning content
 */
export async function getLearningContent(
  config: WorkdayConfig,
  limit?: number,
  offset?: number,
  searchTerm?: string
): Promise<any> {
  let path = `/ccx/api/v1/${config.tenant}/learningContent`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (searchTerm) params.append('search', searchTerm);
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

/**
 * Get specific learning content details
 */
export async function getLearningContentDetails(
  config: WorkdayConfig,
  learningContentId: string
): Promise<any> {
  const path = `/ccx/api/v1/${config.tenant}/learningContent/${learningContentId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

/**
 * Update learning enrollment status
 */
export async function updateLearningEnrollment(
  config: WorkdayConfig,
  enrollmentId: string,
  updateData: {
    status?: 'Enrolled' | 'In Progress' | 'Completed' | 'Cancelled';
    completionDate?: string;
    score?: number;
    comment?: string;
  }
): Promise<any> {
  const path = `/ccx/api/v1/${config.tenant}/learningEnrollments/${enrollmentId}`;
  return makeWorkdayRequest(config, 'PATCH', path, updateData);
}

/**
 * Get learning enrollment details
 */
export async function getLearningEnrollment(
  config: WorkdayConfig,
  enrollmentId: string
): Promise<any> {
  const path = `/ccx/api/v1/${config.tenant}/learningEnrollments/${enrollmentId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

/**
 * Cancel learning enrollment
 */
export async function cancelLearningEnrollment(
  config: WorkdayConfig,
  enrollmentId: string,
  reason?: string
): Promise<any> {
  const path = `/ccx/api/v1/${config.tenant}/learningEnrollments/${enrollmentId}/cancel`;
  const payload = reason ? { cancellationReason: reason } : {};
  return makeWorkdayRequest(config, 'POST', path, payload);
}

/**
 * Search learning content with filters
 */
export async function searchLearningContent(
  config: WorkdayConfig,
  searchParams: {
    searchTerm?: string;
    category?: string;
    provider?: string;
    duration?: string;
    difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
    language?: string;
    limit?: number;
    offset?: number;
  }
): Promise<any> {
  let path = `/ccx/api/v1/${config.tenant}/learningContent/search`;
  const params = new URLSearchParams();
  
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, value.toString());
    }
  });
  
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

/**
 * Get learning progress for a worker
 */
export async function getWorkerLearningProgress(
  config: WorkdayConfig,
  workerId: string,
  learningContentId?: string
): Promise<any> {
  let path = `/ccx/api/v1/${config.tenant}/workers/${workerId}/learningProgress`;
  if (learningContentId) {
    path += `/${learningContentId}`;
  }
  
  return makeWorkdayRequest(config, 'GET', path);
}

/**
 * Get learning categories
 */
export async function getLearningCategories(
  config: WorkdayConfig,
  limit?: number,
  offset?: number
): Promise<any> {
  let path = `/ccx/api/v1/${config.tenant}/learningCategories`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
} 
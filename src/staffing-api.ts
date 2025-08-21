import * as https from 'https';

// Configuration interface
interface WorkdayConfig {
  baseUrl: string;
  tenant: string;
  getAccessToken: () => Promise<string>; // Changed from bearerToken to getAccessToken function
}

// Generic API request function
async function makeWorkdayRequest(
  config: WorkdayConfig,
  method: string,
  path: string,
  data?: any
): Promise<any> {
  const accessToken = await config.getAccessToken(); // Use function to get valid token
  const url = `${config.baseUrl}${path}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(url).hostname,
      port: 443,
      path: new URL(url).pathname + (new URL(url).search || ''),
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      } as Record<string, string>
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const response = responseData ? JSON.parse(responseData) : {};
          const statusCode = res.statusCode || 500;
          if (statusCode >= 200 && statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`Workday API error (${statusCode}): ${response.error || responseData}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Workday response: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Workday API request error: ${error.message}`));
    });

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Job Changes API functions
export async function initiateJobChange(config: WorkdayConfig, workerId: string, jobChangeData?: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/jobChanges`;
  
  // Provide default values for required fields if not provided
  const defaultJobChangeData = {
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    reason: {
      descriptor: "General Job Change"
    },
    ...jobChangeData // Override with any provided data
  };
  
  return makeWorkdayRequest(config, 'POST', path, defaultJobChangeData);
}

export async function getJobChange(config: WorkdayConfig, jobChangeId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

export async function updateJobChangeLocation(config: WorkdayConfig, jobChangeId: string, locationId: string, locationData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/location/${locationId}`;
  return makeWorkdayRequest(config, 'PATCH', path, locationData);
}

export async function updateJobChangeAdministrativeOptions(config: WorkdayConfig, jobChangeId: string, adminOptionsId: string, adminData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/administrativeOptions/${adminOptionsId}`;
  return makeWorkdayRequest(config, 'PATCH', path, adminData);
}

export async function updateJobChangeMoveTeamOptions(config: WorkdayConfig, jobChangeId: string, moveTeamId: string, moveTeamData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/moveTeamOptions/${moveTeamId}`;
  return makeWorkdayRequest(config, 'PATCH', path, moveTeamData);
}

export async function updateJobChangeStartDetails(config: WorkdayConfig, jobChangeId: string, startDetailsId: string, startData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/startDetails/${startDetailsId}`;
  return makeWorkdayRequest(config, 'PATCH', path, startData);
}

export async function updateJobChangeContracts(config: WorkdayConfig, jobChangeId: string, contractId: string, contractData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/contracts/${contractId}`;
  return makeWorkdayRequest(config, 'PATCH', path, contractData);
}

export async function updateJobChangeBusinessTitle(config: WorkdayConfig, jobChangeId: string, businessTitleId: string, titleData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/businessTitle/${businessTitleId}`;
  return makeWorkdayRequest(config, 'PATCH', path, titleData);
}

export async function updateJobChangeJobProfile(config: WorkdayConfig, jobChangeId: string, jobProfileId: string, profileData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/jobProfile/${jobProfileId}`;
  return makeWorkdayRequest(config, 'PATCH', path, profileData);
}

export async function updateJobChangePosition(config: WorkdayConfig, jobChangeId: string, positionId: string, positionData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/position/${positionId}`;
  return makeWorkdayRequest(config, 'PATCH', path, positionData);
}

export async function updateJobChangeJobClassification(config: WorkdayConfig, jobChangeId: string, classificationId: string, classificationData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/jobClassification/${classificationId}`;
  return makeWorkdayRequest(config, 'PATCH', path, classificationData);
}

export async function submitJobChange(config: WorkdayConfig, jobChangeId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobChanges/${jobChangeId}/submit`;
  return makeWorkdayRequest(config, 'POST', path);
}

// Job Families API functions 
export async function getJobFamilies(config: WorkdayConfig, limit?: number, offset?: number): Promise<any> {
  // Try different possible endpoints for job families in Staffing API only
  const possiblePaths = [
    // Staffing API v7 paths only
    `/ccx/api/staffing/v7/${config.tenant}/jobFamilies`,
    `/ccx/api/staffing/v7/${config.tenant}/job-families`,
    `/ccx/api/staffing/v7/${config.tenant}/jobs/families`,
    `/ccx/api/staffing/v7/${config.tenant}/referenceData/jobFamilies`,
    `/ccx/api/staffing/v7/${config.tenant}/job_families`,
    `/ccx/api/staffing/v7/${config.tenant}/jobFamily`,
  ];
  
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  const queryString = params.toString() ? `?${params.toString()}` : '';
  
  // Try each possible path until one works
  for (const basePath of possiblePaths) {
    try {
      const path = basePath + queryString;
      return await makeWorkdayRequest(config, 'GET', path);
    } catch (error) {
      // Continue to next path
    }
  }
  
  // If no endpoints work, provide a more helpful error with alternative suggestions
  return {
    error: 'Job families endpoint not found in Staffing API',
    message: 'Job families may not be available through the Staffing API v7 for your tenant configuration.',
    suggestions: [
      'Job families might be available through SOAP APIs instead of REST',
      'Check if your tenant has job families configured in Workday',
      'Verify your user has permissions to access job family data in Staffing API',
      'Consider using supervisory organizations for organizational structure data'
    ],
    attemptedEndpoints: possiblePaths,
    alternative: 'Use get_supervisory_organizations tool for organizational structure data'
  };
}

export async function getJobFamily(config: WorkdayConfig, jobFamilyId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobFamilies/${jobFamilyId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

// Job Profiles API functions
export async function getJobProfiles(config: WorkdayConfig, limit?: number, offset?: number): Promise<any> {
  // Try different possible endpoints for job profiles across different APIs
  const possiblePaths = [
    // Staffing API v7 paths
    `/ccx/api/staffing/v7/${config.tenant}/jobProfiles`,
    `/ccx/api/staffing/v7/${config.tenant}/job-profiles`,
    `/ccx/api/staffing/v7/${config.tenant}/jobs/profiles`,
    `/ccx/api/staffing/v7/${config.tenant}/referenceData/jobProfiles`,
    
    // Talent Management API paths
    `/ccx/api/talent/v1/${config.tenant}/jobProfiles`,
    `/ccx/api/talent/v2/${config.tenant}/jobProfiles`,
    
    // HCM API paths
    `/ccx/api/hcm/v1/${config.tenant}/jobProfiles`,
    `/ccx/api/hcm/v1/${config.tenant}/referenceData/jobProfiles`,
    
    // Common Data API paths  
    `/ccx/api/common/v1/${config.tenant}/jobProfiles`,
    `/ccx/api/common/v1/${config.tenant}/referenceData/jobProfiles`,
    
    // Alternative naming conventions
    `/ccx/api/staffing/v7/${config.tenant}/job_profiles`,
    `/ccx/api/staffing/v7/${config.tenant}/jobProfile`,
  ];
  
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  const queryString = params.toString() ? `?${params.toString()}` : '';
  
  // Try each possible path until one works
  for (const basePath of possiblePaths) {
    try {
      const path = basePath + queryString;
      return await makeWorkdayRequest(config, 'GET', path);
    } catch (error) {
      // Continue to next path
    }
  }
  
  // If no endpoints work, provide a more helpful error with alternative suggestions
  return {
    error: 'Job profiles endpoint not found in REST APIs',
    message: 'Job profiles may not be available through the REST APIs for your tenant configuration.',
    suggestions: [
      'Job profiles might be available through SOAP APIs',
      'Check if your tenant has job profiles configured in Workday',
      'Verify your user has permissions to access job profile data',
      'Try using supervisory organizations or workers endpoints for organization structure'
    ],
    attemptedEndpoints: possiblePaths,
    alternative: 'Use get_supervisory_organizations or search_workday_workers for organizational data'
  };
}

export async function getJobProfile(config: WorkdayConfig, jobProfileId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobProfiles/${jobProfileId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

export async function createJobProfile(config: WorkdayConfig, jobProfileData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobProfiles`;
  return makeWorkdayRequest(config, 'POST', path, jobProfileData);
}

// Jobs API functions
export async function getJobs(config: WorkdayConfig, limit?: number, offset?: number): Promise<any> {
  let path = `/ccx/api/staffing/v7/${config.tenant}/jobs`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

export async function getJob(config: WorkdayConfig, jobId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobs/${jobId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

export async function getJobWorkspaces(config: WorkdayConfig, jobId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/jobs/${jobId}/workspaces`;
  return makeWorkdayRequest(config, 'GET', path);
}

// Organization Assignment Changes API functions
export async function initiateOrganizationAssignmentChange(config: WorkdayConfig, workerId: string, orgAssignmentData?: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/organizationAssignmentChanges`;
  return makeWorkdayRequest(config, 'POST', path, orgAssignmentData);
}

export async function getOrganizationAssignmentChange(config: WorkdayConfig, orgAssignmentId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/organizationAssignmentChanges/${orgAssignmentId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

export async function updateOrganizationAssignmentChangeCompany(config: WorkdayConfig, orgAssignmentId: string, companyId: string, companyData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/organizationAssignmentChanges/${orgAssignmentId}/company/${companyId}`;
  return makeWorkdayRequest(config, 'PATCH', path, companyData);
}

export async function updateOrganizationAssignmentChangeCostCenter(config: WorkdayConfig, orgAssignmentId: string, costCenterId: string, costCenterData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/organizationAssignmentChanges/${orgAssignmentId}/costCenter/${costCenterId}`;
  return makeWorkdayRequest(config, 'PATCH', path, costCenterData);
}

export async function updateOrganizationAssignmentChangeCosting(config: WorkdayConfig, orgAssignmentId: string, costingId: string, costingData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/organizationAssignmentChanges/${orgAssignmentId}/costing/${costingId}`;
  return makeWorkdayRequest(config, 'PATCH', path, costingData);
}

export async function updateOrganizationAssignmentChangeRegion(config: WorkdayConfig, orgAssignmentId: string, regionId: string, regionData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/organizationAssignmentChanges/${orgAssignmentId}/region/${regionId}`;
  return makeWorkdayRequest(config, 'PATCH', path, regionData);
}

export async function updateOrganizationAssignmentChangeStartDetails(config: WorkdayConfig, orgAssignmentId: string, startDetailsId: string, startData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/organizationAssignmentChanges/${orgAssignmentId}/startDetails/${startDetailsId}`;
  return makeWorkdayRequest(config, 'PATCH', path, startData);
}

export async function submitOrganizationAssignmentChange(config: WorkdayConfig, orgAssignmentId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/organizationAssignmentChanges/${orgAssignmentId}/submit`;
  return makeWorkdayRequest(config, 'POST', path);
}

// Supervisory Organizations API functions
export async function getSupervisoryOrganizations(config: WorkdayConfig, limit?: number, offset?: number): Promise<any> {
  let path = `/ccx/api/staffing/v7/${config.tenant}/supervisoryOrganizations`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

export async function getSupervisoryOrganization(config: WorkdayConfig, supervisoryOrgId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/supervisoryOrganizations/${supervisoryOrgId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

// Worker Check-ins API functions
export async function getWorkerCheckIns(config: WorkdayConfig, workerId: string, limit?: number, offset?: number): Promise<any> {
  let path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/checkIns`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

export async function getWorkerCheckIn(config: WorkdayConfig, workerId: string, checkInId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/checkIns/${checkInId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

export async function createWorkerCheckIn(config: WorkdayConfig, workerId: string, checkInData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/checkIns`;
  return makeWorkdayRequest(config, 'POST', path, checkInData);
}

export async function updateWorkerCheckIn(config: WorkdayConfig, workerId: string, checkInId: string, checkInData: any): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/checkIns/${checkInId}`;
  return makeWorkdayRequest(config, 'PATCH', path, checkInData);
}

// Workers API functions (staffing information for non-terminated workers)
export async function getStaffingWorkers(config: WorkdayConfig, limit?: number, offset?: number): Promise<any> {
  let path = `/ccx/api/staffing/v7/${config.tenant}/workers`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

export async function getStaffingWorker(config: WorkdayConfig, workerId: string): Promise<any> {
  const path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}`;
  return makeWorkdayRequest(config, 'GET', path);
}

// Additional utility functions for common operations
export async function searchStaffingWorkers(config: WorkdayConfig, searchTerm: string, limit?: number): Promise<any> {
  let path = `/ccx/api/staffing/v7/${config.tenant}/workers`;
  const params = new URLSearchParams();
  params.append('search', searchTerm);
  if (limit) params.append('limit', limit.toString());
  path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

export async function getWorkerJobChanges(config: WorkdayConfig, workerId: string, limit?: number, offset?: number): Promise<any> {
  let path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/jobChanges`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
}

export async function getWorkerOrganizationAssignmentChanges(config: WorkdayConfig, workerId: string, limit?: number, offset?: number): Promise<any> {
  let path = `/ccx/api/staffing/v7/${config.tenant}/workers/${workerId}/organizationAssignmentChanges`;
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());
  if (params.toString()) path += `?${params.toString()}`;
  
  return makeWorkdayRequest(config, 'GET', path);
} 
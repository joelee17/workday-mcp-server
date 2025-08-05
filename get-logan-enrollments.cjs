require('dotenv').config();

async function getLoganLearningEnrollments() {
  console.log('📚 Getting Logan McNeil\'s Learning Enrollments');
  console.log('==============================================\n');

  try {
    // Dynamically import the learning API functions
    const {
      getWorkerLearningEnrollments,
      getWorkerLearningProgress,
      getLearningContent
    } = await import('./dist/learning-api.js');

    // Configuration
    const config = {
      baseUrl: process.env.WORKDAY_BASE_URL || 'https://wcpdev-services1.wd101.myworkday.com',
      tenant: process.env.WORKDAY_TENANT || 'wday_wcpdev11',
      bearerToken: process.env.WORKDAY_BEARER_TOKEN || 'your-bearer-token-here'
    };

    // Logan McNeil's Worker ID
    const LOGAN_WORKER_ID = '3aa5550b7fe348b98d7b5741afc65534';

    console.log(`👤 Worker: Logan McNeil`);
    console.log(`🆔 Worker ID: ${LOGAN_WORKER_ID}`);
    console.log(`🏢 Tenant: ${config.tenant}`);
    console.log(`🌐 Base URL: ${config.baseUrl}\n`);

    // Step 1: Get Logan's learning enrollments
    console.log('📋 Step 1: Retrieving Logan\'s learning enrollments...');
    try {
      const enrollments = await getWorkerLearningEnrollments(config, LOGAN_WORKER_ID, 20, 0);
      
      console.log('✅ Learning enrollments retrieved successfully!');
      console.log('\n📊 Enrollment Details:');
      console.log(JSON.stringify(enrollments, null, 2));

      // Parse and display enrollment summary if data exists
      if (enrollments && enrollments.data && Array.isArray(enrollments.data)) {
        console.log(`\n📈 Enrollment Summary:`);
        console.log(`   Total Enrollments: ${enrollments.data.length}`);
        
        if (enrollments.data.length > 0) {
          console.log('\n📚 Course Details:');
          enrollments.data.forEach((enrollment, index) => {
            console.log(`   ${index + 1}. Course: ${enrollment.learningContent?.title || enrollment.learningContentId || 'Unknown'}`);
            console.log(`      Status: ${enrollment.status || 'Unknown'}`);
            console.log(`      Enrollment Date: ${enrollment.enrollmentDate || 'Unknown'}`);
            console.log(`      Due Date: ${enrollment.dueDate || 'Not specified'}`);
            console.log(`      Progress: ${enrollment.completionPercentage || 0}%`);
            console.log(`      Priority: ${enrollment.priority || 'Not specified'}`);
            console.log('');
          });
        } else {
          console.log('   📝 No active learning enrollments found for Logan McNeil');
        }
      }

    } catch (error) {
      console.log('❌ Error getting learning enrollments:', error.message);
      
      // Check if it's an authentication error
      if (error.message.includes('401') || error.message.includes('Invalid access token')) {
        console.log('\n🔐 Authentication Issue Detected:');
        console.log('   - Invalid or expired bearer token');
        console.log('   - Set WORKDAY_BEARER_TOKEN environment variable');
        console.log('   - Ensure token has Learning API permissions');
      } else if (error.message.includes('404')) {
        console.log('\n👤 Worker Not Found:');
        console.log('   - Worker ID may be incorrect');
        console.log('   - Worker may not exist in the system');
        console.log('   - Check worker ID format');
      } else if (error.message.includes('403')) {
        console.log('\n🚫 Permission Denied:');
        console.log('   - Learning API access not enabled');
        console.log('   - Contact Workday administrator');
        console.log('   - Enable Learning domain permissions');
      }
    }

    // Step 2: Get Logan's learning progress
    console.log('\n📈 Step 2: Retrieving Logan\'s learning progress...');
    try {
      const progress = await getWorkerLearningProgress(config, LOGAN_WORKER_ID);
      
      console.log('✅ Learning progress retrieved successfully!');
      console.log('\n📊 Progress Details:');
      console.log(JSON.stringify(progress, null, 2));

      // Parse and display progress summary if data exists
      if (progress && progress.data && Array.isArray(progress.data)) {
        console.log(`\n📈 Progress Summary:`);
        console.log(`   Total Learning Items: ${progress.data.length}`);
        
        if (progress.data.length > 0) {
          console.log('\n🎯 Progress Breakdown:');
          progress.data.forEach((item, index) => {
            console.log(`   ${index + 1}. Course: ${item.learningContent?.title || item.learningContentId || 'Unknown'}`);
            console.log(`      Completion: ${item.completionPercentage || 0}%`);
            console.log(`      Status: ${item.status || 'Unknown'}`);
            console.log(`      Last Activity: ${item.lastActivityDate || 'Unknown'}`);
            console.log('');
          });
        }
      }

    } catch (error) {
      console.log('❌ Error getting learning progress:', error.message);
    }

    // Step 3: Try to get available learning content for context
    console.log('\n📚 Step 3: Getting available learning content for reference...');
    try {
      const availableContent = await getLearningContent(config, 5, 0);
      
      console.log('✅ Available learning content retrieved!');
      console.log('\n📖 Available Courses (Sample):');
      console.log(JSON.stringify(availableContent, null, 2));

      if (availableContent && availableContent.data && Array.isArray(availableContent.data)) {
        console.log(`\n📚 Available Content Summary:`);
        console.log(`   Total Available Courses: ${availableContent.total || availableContent.data.length}`);
        
        if (availableContent.data.length > 0) {
          console.log('\n📋 Sample Courses:');
          availableContent.data.slice(0, 3).forEach((course, index) => {
            console.log(`   ${index + 1}. ${course.title || course.id || 'Unknown Course'}`);
            console.log(`      Category: ${course.category || 'Not specified'}`);
            console.log(`      Duration: ${course.duration || 'Not specified'}`);
            console.log(`      Provider: ${course.provider || 'Not specified'}`);
            console.log('');
          });
        }
      }

    } catch (error) {
      console.log('❌ Error getting available learning content:', error.message);
    }

    return {
      workerId: LOGAN_WORKER_ID,
      workerName: 'Logan McNeil',
      status: 'query_completed',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Logan McNeil Learning Enrollment Query...\n');
  
  // Check environment variables
  if (!process.env.WORKDAY_BEARER_TOKEN) {
    console.log('⚠️  Warning: WORKDAY_BEARER_TOKEN not set in environment');
    console.log('   API calls will likely return 401 authentication errors');
    console.log('   This is expected for demonstration purposes\n');
  }

  try {
    const result = await getLoganLearningEnrollments();
    
    console.log('\n🎉 Learning enrollment query completed!');
    console.log('\n📋 What We Attempted:');
    console.log('   ✅ Query Logan\'s current learning enrollments');
    console.log('   ✅ Retrieve learning progress and completion status');
    console.log('   ✅ Get available learning content for context');
    console.log('   ✅ Provide detailed error handling and diagnostics');
    
    console.log('\n🔧 Learning API Tools Used:');
    console.log('   - getWorkerLearningEnrollments()');
    console.log('   - getWorkerLearningProgress()');
    console.log('   - getLearningContent()');
    
    console.log('\n📊 Expected Data Structure:');
    console.log('   - Enrollment ID and status');
    console.log('   - Learning content details');
    console.log('   - Enrollment and due dates');
    console.log('   - Completion percentage');
    console.log('   - Assignment priority and reason');
    
    return result;
    
  } catch (error) {
    console.error('\n💥 Error during learning enrollment query:', error.message);
    
    console.log('\n🔍 Troubleshooting Steps:');
    console.log('   1. Verify WORKDAY_BEARER_TOKEN is valid and current');
    console.log('   2. Ensure Learning API permissions are enabled');
    console.log('   3. Confirm Logan McNeil\'s worker ID is correct');
    console.log('   4. Check Workday tenant Learning module configuration');
    console.log('   5. Verify network connectivity to Workday tenant');
    
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getLoganLearningEnrollments, main }; 
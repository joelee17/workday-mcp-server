// Load environment variables from workday.env file
require('dotenv').config({ path: '../workday.env' });

// Example configuration
const config = {
  baseUrl: process.env.WORKDAY_BASE_URL || 'https://wcpdev-services1.wd101.myworkday.com',
  tenant: process.env.WORKDAY_TENANT || 'wday_wcpdev11',
  bearerToken: process.env.WORKDAY_BEARER_TOKEN || 'your-bearer-token-here'
};

// Example worker and learning content IDs
const EXAMPLE_WORKER_ID = '3aa5550b7fe348b98d7b5741afc65534'; // Logan McNeil
const EXAMPLE_LEARNING_CONTENT_ID = 'LEARN_001'; // Example learning content ID

async function demonstrateLearningAPI() {
  console.log('🚀 Starting Workday Learning API demonstration...');
  
  // Log configuration status
  console.log(`\n📋 Configuration Status:`);
  console.log(`   - Base URL: ${config.baseUrl}`);
  console.log(`   - Tenant: ${config.tenant}`);
  console.log(`   - Bearer Token: ${config.bearerToken ? `${config.bearerToken.substring(0, 20)}...` : 'Not set'}`);
  
  if (!config.bearerToken || config.bearerToken === 'your-bearer-token-here') {
    console.log('⚠️  Warning: WORKDAY_BEARER_TOKEN environment variable not set');
    console.log('   Please set your bearer token in the .env file or environment variables');
    console.log('   Some API calls may fail without proper authentication');
  }
  
  console.log('\n🎓 Workday Learning API Examples');
  console.log('=================================\n');

  try {
    // Dynamically import the learning API functions
    const {
      enrollInLearningContent,
      getLearningContent,
      getLearningContentDetails,
      getWorkerLearningEnrollments,
      getWorkerLearningProgress,
      searchLearningContent,
      updateLearningEnrollment,
      cancelLearningEnrollment,
      getLearningCategories
    } = await import('../dist/learning-api.js');

    // 1. Get available learning content
    console.log('1. Getting available learning content...');
    try {
      const learningContent = await getLearningContent(config, 10, 0, 'safety');
      console.log('✅ Learning content retrieved:');
      console.log(JSON.stringify(learningContent, null, 2));
    } catch (error) {
      console.log('❌ Error getting learning content:', error.message);
    }
    console.log('\n' + '='.repeat(50) + '\n');

    // 2. Search learning content with filters
    console.log('2. Searching learning content with filters...');
    try {
      const searchResults = await searchLearningContent(config, {
        searchTerm: 'compliance',
        category: 'mandatory',
        difficulty: 'Beginner',
        limit: 5
      });
      console.log('✅ Search results:');
      console.log(JSON.stringify(searchResults, null, 2));
    } catch (error) {
      console.log('❌ Error searching learning content:', error.message);
    }
    console.log('\n' + '='.repeat(50) + '\n');

    // 3. Get learning categories
    console.log('3. Getting learning categories...');
    try {
      const categories = await getLearningCategories(config, 20, 0);
      console.log('✅ Learning categories:');
      console.log(JSON.stringify(categories, null, 2));
    } catch (error) {
      console.log('❌ Error getting learning categories:', error.message);
    }
    console.log('\n' + '='.repeat(50) + '\n');

    // 4. Get worker learning enrollments
    console.log('4. Getting worker learning enrollments...');
    try {
      const enrollments = await getWorkerLearningEnrollments(config, EXAMPLE_WORKER_ID, 10, 0);
      console.log('✅ Worker learning enrollments:');
      console.log(JSON.stringify(enrollments, null, 2));
    } catch (error) {
      console.log('❌ Error getting worker learning enrollments:', error.message);
    }
    console.log('\n' + '='.repeat(50) + '\n');

    // 5. Get worker learning progress
    console.log('5. Getting worker learning progress...');
    try {
      const progress = await getWorkerLearningProgress(config, EXAMPLE_WORKER_ID);
      console.log('✅ Worker learning progress:');
      console.log(JSON.stringify(progress, null, 2));
    } catch (error) {
      console.log('❌ Error getting worker learning progress:', error.message);
    }
    console.log('\n' + '='.repeat(50) + '\n');

    // 6. Enroll worker in learning content (commented out to avoid actual enrollment)
    console.log('6. Example: Enrolling worker in learning content...');
    console.log('(This is commented out to avoid actual enrollment)');
    /*
    try {
      const enrollmentData = {
        workerId: EXAMPLE_WORKER_ID,
        learningContentId: EXAMPLE_LEARNING_CONTENT_ID,
        enrollmentDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
        comment: 'Enrolled via API example',
        autoEnroll: true,
        sendNotification: true,
        assignmentReason: 'Manager Assignment',
        priority: 'Medium'
      };
      
      const enrollment = await enrollInLearningContent(config, enrollmentData);
      console.log('✅ Worker enrolled in learning content:');
      console.log(JSON.stringify(enrollment, null, 2));
    } catch (error) {
      console.log('❌ Error enrolling worker in learning content:', error.message);
    }
    */
    console.log('\n' + '='.repeat(50) + '\n');

    // 7. Get specific learning content details
    console.log('7. Getting specific learning content details...');
    try {
      const contentDetails = await getLearningContentDetails(config, EXAMPLE_LEARNING_CONTENT_ID);
      console.log('✅ Learning content details:');
      console.log(JSON.stringify(contentDetails, null, 2));
    } catch (error) {
      console.log('❌ Error getting learning content details:', error.message);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Example usage of the learning API functions
async function main() {
  console.log('🚀 Starting Workday Learning API demonstration...\n');
  
  // Check if environment variables are set
  if (!process.env.WORKDAY_BEARER_TOKEN) {
    console.log('⚠️  Warning: WORKDAY_BEARER_TOKEN environment variable not set');
    console.log('   Please set your bearer token in the .env file or environment variables');
    console.log('   Some API calls may fail without proper authentication\n');
  }

  await demonstrateLearningAPI();
  
  console.log('\n🎉 Learning API demonstration completed!');
  console.log('\n📚 Available Learning API Functions:');
  console.log('   - enrollInLearningContent()');
  console.log('   - getLearningContent()');
  console.log('   - getLearningContentDetails()');
  console.log('   - getWorkerLearningEnrollments()');
  console.log('   - getWorkerLearningProgress()');
  console.log('   - searchLearningContent()');
  console.log('   - updateLearningEnrollment()');
  console.log('   - cancelLearningEnrollment()');
  console.log('   - getLearningCategories()');
  
  console.log('\n🔗 MCP Server Tools:');
  console.log('   - enroll_in_learning_content');
  console.log('   - get_learning_content');
  console.log('   - get_learning_content_details');
  console.log('   - get_worker_learning_enrollments');
  console.log('   - get_worker_learning_progress');
  console.log('   - search_learning_content');
  console.log('   - update_learning_enrollment');
  console.log('   - cancel_learning_enrollment');
  console.log('   - get_learning_categories');
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  demonstrateLearningAPI,
  config,
  EXAMPLE_WORKER_ID,
  EXAMPLE_LEARNING_CONTENT_ID
}; 
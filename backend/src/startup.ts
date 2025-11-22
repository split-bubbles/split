import { brokerService, OFFICIAL_PROVIDERS } from './services/brokerService';

/**
 * Initialize the application and ensure prerequisite resources exist
 */
export const initializeApplication = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing application...');
    
    // Check if ledger exists, create with default values if not
    try {
      const balanceInfo = await brokerService.getBalance();
      console.log('✅ Ledger account exists:', balanceInfo);
    } catch (error) {
      console.log('⚠️ Ledger account does not exist, creating...');
      // Default initial amount, can be adjusted as needed
      const initialAmount = 0.01; 
      await brokerService.addFundsToLedger(initialAmount);
      console.log(`✅ Ledger account created with ${initialAmount} initial funds`);
    }

    // Acknowledge and fund official providers for vision and reasoning
    const qwenProvider = OFFICIAL_PROVIDERS['qwen2.5-vl-72b-instruct'];
    const deepseekProvider = OFFICIAL_PROVIDERS['deepseek-r1-70b'];

    try {
      console.log('🔄 Setting up Qwen vision provider...');
      await brokerService.acknowledgeProvider(qwenProvider);
      await brokerService.transferFundsToProvider(qwenProvider, 1.0);
      console.log('✅ Qwen provider ready');
    } catch (error: any) {
      console.log(`ℹ️ Qwen provider setup: ${error.message}`);
    }

    try {
      console.log('🔄 Setting up Deepseek reasoning provider...');
      await brokerService.acknowledgeProvider(deepseekProvider);
      await brokerService.transferFundsToProvider(deepseekProvider, 1.0);
      console.log('✅ Deepseek provider ready');
    } catch (error: any) {
      console.log(`ℹ️ Deepseek provider setup: ${error.message}`);
    }
    
    console.log('✅ Application initialization complete');
  } catch (error: any) {
    console.error('❌ Application initialization failed:', error.message);
    throw new Error(`Application initialization failed: ${error.message}`);
  }
}; 
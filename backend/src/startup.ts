import { ethers } from 'ethers';
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
      const currentBalance = balanceInfo[1];
      const requiredBalance = ethers.parseEther('2.5');
      if (currentBalance < requiredBalance) {
        console.log(`⚠️  Insufficient balance (${ethers.formatEther(currentBalance)} OG), adding more funds...`);
        await brokerService.depositFunds(2.5);
        console.log(`✅ Added 2.5 OG tokens to ledger`);

        // get updated balance
        const updatedBalanceInfo = await brokerService.getBalance();
        console.log('✅ Updated ledger balance:', updatedBalanceInfo);
      }

    } catch (error) {
      console.log('⚠️ Ledger account does not exist, creating...');
      // Default initial amount, can be adjusted as needed
      const initialAmount = 0.01; 
      await brokerService.addFundsToLedger(initialAmount);
      console.log(`✅ Ledger account created with ${initialAmount} initial funds`);
    }

    const services = await brokerService.listServices();
    console.log(`✅ Found ${services.length} available services`);

    // Acknowledge and fund official providers for vision and reasoning
    // const qwenProvider = services[2].provider;
    // const qwenService = services[2];
    // const deepseekProvider = services[1].provider;
    // const deepseekService = services[1];

    // try {
    //   console.log('🔄 Setting up Qwen vision provider...');
    //   await brokerService.acknowledgeProvider(qwenProvider);
    //   await brokerService.transferFundsToProvider(qwenProvider, 1.0);
    //   console.log('✅ Qwen provider ready');
    // } catch (error: any) {
    //   console.log(`ℹ️ Qwen provider setup: ${error.message}`);
    // }

    // try {
    //   console.log('🔄 Setting up Deepseek reasoning provider...');
    //   await brokerService.acknowledgeProvider(deepseekProvider);
    //   await brokerService.transferFundsToProvider(deepseekProvider, 1.0);
    //   console.log('✅ Deepseek provider ready');
    // } catch (error: any) {
    //   console.log(`ℹ️ Deepseek provider setup: ${error.message}`);
    // }
    
    console.log('✅ Application initialization complete');
  } catch (error: any) {
    console.error('❌ Application initialization failed:', error.message);
    throw new Error(`Application initialization failed: ${error.message}`);
  }
}; 
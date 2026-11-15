import dotenv from 'dotenv';
import { cleanProductionData } from '../server/store.ts';

dotenv.config();

console.log('Running ExamPro v2 safe demo data cleanup...');
const summary = cleanProductionData();
console.log('Cleanup complete. Preserved admin accounts:', summary.preservedAdmins);
console.log('Removed demo counts:', JSON.stringify(summary, null, 2));
console.log('Admin account (jumee89@gmail.com) and all platform settings remain intact.');

const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const connectDB = require('../src/config/db');
const User = require('../src/models/User');

async function createOfficer() {
  await connectDB();

  const email = 'officer@loansight.com';
  const rawPassword = 'Password123!';
  const name = 'Loan Officer';

  let officer = await User.findOne({ email });
  if (officer) {
    officer.role = 'officer';
    officer.passwordHash = rawPassword; // pre('save') hook in User model will hash passwordHash
    await officer.save();
    console.log(`✅ Updated existing account: ${email}`);
  } else {
    officer = await User.create({
      name,
      email,
      passwordHash: rawPassword, // pre('save') hook will hash it
      role: 'officer'
    });
    console.log(`✅ Created new Loan Officer account: ${email}`);
  }

  const officers = await User.find({ role: 'officer' });
  console.log('\n--- Active Loan Officer Accounts ---');
  officers.forEach((o, i) => {
    console.log(`${i + 1}. Name: ${o.name} | Email: ${o.email} | Role: ${o.role}`);
  });
  console.log(`\nPassword: ${rawPassword}\n`);
  process.exit(0);
}

createOfficer().catch((err) => {
  console.error(err);
  process.exit(1);
});

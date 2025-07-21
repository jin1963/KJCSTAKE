let web3;
let contract;
let token;
let user;

async function initWeb3() {
  if (typeof window.ethereum !== 'undefined') {
    web3 = new Web3(window.ethereum);
    token = new web3.eth.Contract(erc20ABI, tokenAddress);
    contract = new web3.eth.Contract(stakingABI, contractAddress);

    ethereum.on('accountsChanged', () => window.location.reload());
    ethereum.on('chainChanged', () => window.location.reload());

    document.getElementById("connectWallet").addEventListener("click", connectWallet);
    document.getElementById("stakeButton").addEventListener("click", stakeTokens);
  } else {
    alert("⚠️ No Web3 provider found. Please use MetaMask, Bitget, or Trust Wallet.");
  }
}

window.addEventListener("load", initWeb3);

async function connectWallet() {
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    user = accounts[0];

    const currentChainId = await ethereum.request({ method: "eth_chainId" });
    // ตรวจสอบ chainId ที่ถูกต้อง, ในที่นี้คือ 0x38 สำหรับ Binance Smart Chain Mainnet
    if (parseInt(currentChainId, 16) !== chainId) { // ตรวจสอบตัวแปร global chainId ของคุณ
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }], // คุณอาจต้องเปลี่ยนเป็น chainId ที่เหมาะสมกับ DApp ของคุณ
      });
    }

    document.getElementById("status").innerHTML = `✅ Connected:<br>${user}`;
    loadStakes();
  } catch (err) {
    console.error("Connection failed:", err);
    document.getElementById("status").innerText = "❌ Connection failed.";
  }
}

async function stakeTokens() {
  const amount = document.getElementById("stakeAmount").value;
  const tier = document.getElementById("stakeTier").value; // Tier ควรสอดคล้องกับ lockPeriod ใน contract
  if (!amount || parseFloat(amount) <= 0) return alert("Enter amount to stake"); // ใช้ parseFloat เพื่อความแม่นยำ

  // ตรวจสอบว่า tier ที่เลือกถูกต้องหรือไม่ (120, 180, 270)
  const validTiers = ['120', '180', '270'];
  if (!validTiers.includes(tier)) {
    return alert("Invalid tier selected. Please choose 120, 180, or 270.");
  }

  const decimals = await token.methods.decimals().call();
  // แปลง amount เป็น BigNumber โดยใช้ unit ที่ถูกต้อง (เช่น 'ether' ถ้า decimals คือ 18)
  const stakeAmount = web3.utils.toWei(amount, 'ether'); // สมมติว่า token มี 18 decimals เหมือน ether

  try {
    // ต้องอนุมัติก่อนถึงจะ stake ได้
    await token.methods.approve(contractAddress, stakeAmount).send({ from: user });
    await contract.methods.stake(stakeAmount, tier).send({ from: user });

    alert("✅ Staked successfully");
    loadStakes();
  } catch (error) {
    console.error("Staking failed:", error);
    alert("❌ Staking failed. Check console for details.");
  }
}

async function loadStakes() {
  const titleContainer = document.getElementById("stakesContainerTitle");
  const container = document.getElementById("stakesContainer");

  titleContainer.innerHTML = "<h2>Your Stakes</h2>";
  container.innerHTML = "";

  let index = 0;
  while (true) {
    try {
      // ตรวจสอบว่า stake.amount ควรเป็น BigNumber และเทียบกับ 0
      const stake = await contract.methods.stakes(user, index).call();
      if (web3.utils.toBN(stake.amount).isZero()) break; // ตรวจสอบว่า amount เป็น 0 หรือไม่

      const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
      const amount = web3.utils.fromWei(stake.amount, "ether"); // สมมติว่า token มี 18 decimals

      // แปลง startTime และ lockPeriod เป็น BigNumber ก่อนการคำนวณ
      const startTimeBN = web3.utils.toBN(stake.startTime);
      const lockPeriodBN = web3.utils.toBN(stake.lockPeriod); // lockPeriod ควรเป็นวินาทีจาก contract

      // คำนวณ unlock time ในหน่วยวินาที
      const unlockTimeInSeconds = startTimeBN.add(lockPeriodBN);

      // แปลง timestamp เป็น Date object โดยคูณด้วย 1000 เพื่อให้เป็น milliseconds
      const start = new Date(startTimeBN.toNumber() * 1000).toLocaleDateString();
      const end = new Date(unlockTimeInSeconds.toNumber() * 1000).toLocaleDateString(); // แปลง BigNumber เป็น Number ก่อนคูณและสร้าง Date

      const card = document.createElement("div");
      card.className = "stake-item";
      card.innerHTML = `
        <p><strong>Amount:</strong> ${amount} KJC</p>
        <p><strong>Start:</strong> ${start}</p>
        <p><strong>Unlock:</strong> ${end}</p>
        <p><strong>Status:</strong> ${stake.claimed ? "✅ Claimed" : "🔒 Locked"}</p>
      `;

      // ตรวจสอบเงื่อนไข claimable และ canUnstake
      // ถ้า lastClaimTime เป็น BigNumber ต้องแปลงเป็น Number ก่อน
      const lastClaimTimeNum = web3.utils.toBN(stake.lastClaimTime).toNumber();
      const claimable = now - lastClaimTimeNum >= (15 * 86400); // 15 วัน

      const canUnstake = now >= unlockTimeInSeconds.toNumber(); // เปรียบเทียบกับ unlockTimeInSeconds ที่คำนวณไว้

      if (!stake.claimed && claimable) {
        const claimBtn = document.createElement("button");
        claimBtn.innerText = "Claim Reward";
        claimBtn.onclick = async () => {
          try {
            await contract.methods.claim(index).send({ from: user });
            alert("✅ Claimed");
            loadStakes();
          } catch (error) {
            console.error("Claim failed:", error);
            alert("❌ Claim failed. Check console for details.");
          }
        };
        card.appendChild(claimBtn);
      }

      if (!stake.claimed && canUnstake) {
        const unstakeBtn = document.createElement("button");
        unstakeBtn.innerText = "Unstake";
        unstakeBtn.onclick = async () => {
          try {
            await contract.methods.unstake(index).send({ from: user });
            alert("✅ Unstaked");
            loadStakes();
          } catch (error) {
            console.error("Unstake failed:", error);
            alert("❌ Unstake failed. Check console for details.");
          }
        };
        card.appendChild(unstakeBtn);
      }

      container.appendChild(card);
      index++;
    } catch (e) {
      console.error("Error loading stake at index", index, ":", e); // เพิ่ม console.error เพื่อดูปัญหาที่แท้จริง
      if (index === 0) container.innerText = "No stakes found.";
      break;
    }
  }
}

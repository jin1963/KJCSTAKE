let web3;
let contract;
let token;
let user;

// เช็ค Web3 provider
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
    if (parseInt(currentChainId, 16) !== chainId) {
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      } catch (switchError) {
        alert("Please switch to Binance Smart Chain.");
        return;
      }
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
  const tier = document.getElementById("stakeTier").value;
  if (!amount || amount <= 0) return alert("Enter amount to stake");

  const decimals = await token.methods.decimals().call();
  const stakeAmount = web3.utils.toBN(amount * (10 ** decimals));

  await token.methods.approve(contractAddress, stakeAmount).send({ from: user });
  await contract.methods.stake(stakeAmount, tier).send({ from: user });

  alert("✅ Staked successfully");
  loadStakes();
}

function formatDate(timestamp) {
  if (!timestamp || timestamp <= 0) return "Invalid ⏰";
  return new Date(timestamp * 1000).toLocaleDateString();
}

async function loadStakes() {
  const container = document.getElementById("stakesContainer");
  container.innerHTML = "";

  let index = 0;
  while (true) {
    try {
      const stake = await contract.methods.stakes(user, index).call();
      if (stake.amount == 0) break;

      const now = Math.floor(Date.now() / 1000);
      const amount = web3.utils.fromWei(stake.amount, "ether");
      const start = formatDate(stake.startTime);
      const end = formatDate(stake.startTime + stake.lockPeriod);

      const pending = await contract.methods.pendingReward(user, index).call();
      const rewardFormatted = web3.utils.fromWei(pending, "ether");

      const card = document.createElement("div");
      card.className = "stake-item";
      card.innerHTML = `
        <p><strong>Amount:</strong> ${amount} KJC</p>
        <p><strong>Start:</strong> ${start}</p>
        <p><strong>Unlock:</strong> ${end}</p>
        <p><strong>Reward:</strong> 💸 ${rewardFormatted} KJC</p>
        <p><strong>Status:</strong> ${stake.claimed ? "✅ Claimed" : "🔒 Locked"}</p>
      `;

      const claimable = now - stake.lastClaimTime >= 15 * 86400;
      const canUnstake = now >= stake.startTime + stake.lockPeriod;

      if (!stake.claimed && claimable && pending > 0) {
        const claimBtn = document.createElement("button");
        claimBtn.innerText = "Claim Reward ⛏️";
        claimBtn.onclick = async () => {
          await contract.methods.claim(index).send({ from: user });
          alert("✅ Claimed");
          loadStakes();
        };
        card.appendChild(claimBtn);
      }

      if (!stake.claimed && canUnstake) {
        const unstakeBtn = document.createElement("button");
        unstakeBtn.innerText = "Unstake 🔓";
        unstakeBtn.onclick = async () => {
          await contract.methods.unstake(index).send({ from: user });
          alert("✅ Unstaked");
          loadStakes();
        };
        card.appendChild(unstakeBtn);
      }

      container.appendChild(card);
      index++;
    } catch (e) {
      if (index === 0) container.innerText = "No stakes found.";
      break;
    }
  }
}

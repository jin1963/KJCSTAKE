
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
    if (parseInt(currentChainId, 16) !== chainId) {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }],
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
  if (!amount || parseFloat(amount) <= 0) return alert("Enter amount to stake");

  const decimals = await token.methods.decimals().call();
  const stakeAmount = web3.utils.toWei(amount, 'ether');

  try {
    await token.methods.approve(contractAddress, stakeAmount).send({ from: user });
    await contract.methods.stake(stakeAmount).send({ from: user });

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

  try {
    const stakeCount = await contract.methods.getStakeCount(user).call();
    for (let i = 0; i < stakeCount; i++) {
      const stake = await contract.methods.stakes(user, i).call();
      if (web3.utils.toBN(stake.amount).isZero()) continue;

      const now = Math.floor(Date.now() / 1000);
      const amount = web3.utils.fromWei(stake.amount, "ether");
      const start = new Date(stake.startTime * 1000).toLocaleDateString();
      const lastClaim = new Date(stake.lastClaimTime * 1000).toLocaleDateString();
      const claimed = stake.claimed;

      const card = document.createElement("div");
      card.className = "stake-item";
      card.innerHTML = `
        <p><strong>Amount:</strong> ${amount} KJC</p>
        <p><strong>Start Time:</strong> ${start}</p>
        <p><strong>Last Claim:</strong> ${lastClaim}</p>
        <p><strong>Status:</strong> ${claimed ? "✅ Claimed" : "🔒 Locked"}</p>
      `;

      const claimable = now - stake.lastClaimTime >= (15 * 86400);

      if (!claimed && claimable) {
        const claimBtn = document.createElement("button");
        claimBtn.innerText = "Claim Reward";
        claimBtn.onclick = async () => {
          try {
            await contract.methods.claimReward(i).send({ from: user });
            alert("✅ Claimed");
            loadStakes();
          } catch (error) {
            console.error("Claim failed:", error);
            alert("❌ Claim failed. Check console for details.");
          }
        };
        card.appendChild(claimBtn);
      }

      const unstakeBtn = document.createElement("button");
      unstakeBtn.innerText = "Unstake";
      unstakeBtn.onclick = async () => {
        try {
          await contract.methods.unstake(i).send({ from: user });
          alert("✅ Unstaked");
          loadStakes();
        } catch (error) {
          console.error("Unstake failed:", error);
          alert("❌ Unstake failed. Check console for details.");
        }
      };
      card.appendChild(unstakeBtn);

      container.appendChild(card);
    }

    if (stakeCount == 0) {
      container.innerText = "No stakes found.";
    }
  } catch (e) {
    console.error("Error loading stakes:", e);
    container.innerText = "Failed to load stakes.";
  }
}

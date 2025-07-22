let web3;
let contract;
let token;
let user;

window.addEventListener("load", async () => {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    await ethereum.request({ method: "eth_requestAccounts" });

    const accounts = await web3.eth.getAccounts();
    user = accounts[0];

    const chainIdHex = await ethereum.request({ method: "eth_chainId" });
    if (parseInt(chainIdHex, 16) !== 56) {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }],
      });
    }

    token = new web3.eth.Contract(erc20ABI, tokenAddress);
    contract = new web3.eth.Contract(stakingABI, contractAddress);

    document.getElementById("status").innerHTML = `✅ Connected: ${user}`;
    document.getElementById("connectWallet").style.display = "none";
    document.getElementById("stakeButton").addEventListener("click", stake);
    loadStakes();
  } else {
    alert("Please install MetaMask or a compatible wallet.");
  }
});

async function stake() {
  const amount = document.getElementById("stakeAmount").value;
  if (!amount || parseFloat(amount) <= 0) return alert("Enter amount");

  const decimals = await token.methods.decimals().call();
  const stakeAmount = web3.utils.toWei(amount, 'ether');

  try {
    await token.methods.approve(contractAddress, stakeAmount).send({ from: user });
    await contract.methods.stake(stakeAmount).send({ from: user });

    alert("✅ Stake successful");
    loadStakes();
  } catch (err) {
    console.error(err);
    alert("❌ Stake failed");
  }
}

async function loadStakes() {
  const container = document.getElementById("stakesContainer");
  container.innerHTML = "";

  try {
    const count = await contract.methods.getStakeCount(user).call();
    for (let i = 0; i < count; i++) {
      const stake = await contract.methods.stakes(user, i).call();

      const amount = web3.utils.fromWei(stake.amount, 'ether');
      const start = new Date(stake.startTime * 1000).toLocaleDateString();
      const unlock = new Date((stake.startTime + 31536000) * 1000).toLocaleDateString(); // 1 ปี

      const now = Math.floor(Date.now() / 1000);
      const lastClaimTime = Number(stake.lastClaimTime);
      const canClaim = now - lastClaimTime >= 15 * 86400;
      const claimed = stake.claimed;

      const div = document.createElement("div");
      div.className = "stake-card";
      div.innerHTML = `
        <p><strong>Amount:</strong> ${amount} KJC</p>
        <p><strong>Start:</strong> ${start}</p>
        <p><strong>Unlock:</strong> ${unlock}</p>
        <p><strong>Status:</strong> ${claimed ? "✅ Claimed" : "🔒 Locked"}</p>
      `;

      if (!claimed && canClaim) {
        const claimBtn = document.createElement("button");
        claimBtn.innerText = "Claim";
        claimBtn.onclick = async () => {
          try {
            await contract.methods.claimReward(i).send({ from: user });
            alert("✅ Claimed");
            loadStakes();
          } catch (err) {
            alert("❌ Claim failed");
            console.error(err);
          }
        };
        div.appendChild(claimBtn);
      }

      if (!claimed && now >= stake.startTime + 31536000) {
        const unstakeBtn = document.createElement("button");
        unstakeBtn.innerText = "Unstake";
        unstakeBtn.onclick = async () => {
          try {
            await contract.methods.unstake(i).send({ from: user });
            alert("✅ Unstaked");
            loadStakes();
          } catch (err) {
            alert("❌ Unstake failed");
            console.error(err);
          }
        };
        div.appendChild(unstakeBtn);
      }

      container.appendChild(div);
    }
  } catch (e) {
    console.error("Error loading stakes", e);
    container.innerHTML = "No stakes found.";
  }
}

// main.js for KJCStakedArrayV2 - Stake without sending tokens into contract

let web3;
let stakingContract;
let tokenContract;
let user;

const stakingAddress = "0x92dCdA45eE76Aa8Af97DaB8bE8e163d3CECa8636";
const tokenAddress = "0xd479ae350dc24168e8db863c5413c35fb2044ecd";
const chainId = 56;

window.addEventListener("load", async () => {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    tokenContract = new web3.eth.Contract(erc20Abi, tokenAddress);
    stakingContract = new web3.eth.Contract(stakingAbi, stakingAddress);

    ethereum.on('accountsChanged', () => window.location.reload());
    ethereum.on('chainChanged', () => window.location.reload());

    document.getElementById("connectWallet").addEventListener("click", connectWallet);
    document.getElementById("stakeButton").addEventListener("click", stakeTokens);
  } else {
    alert("⚠️ Web3 provider not found. Use MetaMask or Bitget Wallet.");
  }
});

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
  const lockDays = document.getElementById("lockDays").value;
  if (!amount || !lockDays) return alert("Enter amount and lock period");

  const stakeAmount = web3.utils.toWei(amount, 'ether');
  const lockSeconds = parseInt(lockDays) * 86400;

  try {
    await tokenContract.methods.approve(stakingAddress, stakeAmount).send({ from: user });
    await stakingContract.methods.stake(stakeAmount, lockSeconds).send({ from: user });
    alert("✅ Staked successfully without transferring tokens to contract");
    loadStakes();
  } catch (error) {
    console.error("Staking failed:", error);
    alert("❌ Staking failed.");
  }
}

async function loadStakes() {
  const container = document.getElementById("stakesContainer");
  container.innerHTML = "";

  try {
    const stakes = await stakingContract.methods.getStakes(user).call();
    const now = Math.floor(Date.now() / 1000);

    stakes.forEach((s, i) => {
      const amount = web3.utils.fromWei(s.amount, "ether");
      const start = new Date(s.startTime * 1000).toLocaleDateString();
      const nextClaim = new Date((s.lastClaimTime * 1000) + 15 * 86400000).toLocaleDateString();
      const unlock = new Date((s.startTime + s.lockPeriod) * 1000).toLocaleDateString();

      const card = document.createElement("div");
      card.className = "stake-item";
      card.innerHTML = `
        <p><strong>Stake #${i + 1}</strong></p>
        <p>Amount: ${amount} KJC</p>
        <p>Start Time: ${start}</p>
        <p>Unlock: ${unlock}</p>
        <p>Next Claim: ${nextClaim}</p>
      `;

      const claimBtn = document.createElement("button");
      claimBtn.innerText = "Claim";
      claimBtn.onclick = async () => {
        try {
          await stakingContract.methods.claimReward(i).send({ from: user });
          alert("✅ Claimed");
          loadStakes();
        } catch (error) {
          console.error("Claim failed:", error);
          alert("❌ Claim failed.");
        }
      };
      card.appendChild(claimBtn);

      const unstakeBtn = document.createElement("button");
      unstakeBtn.innerText = "Unstake";
      unstakeBtn.onclick = async () => {
        try {
          await stakingContract.methods.unstake(i).send({ from: user });
          alert("✅ Unstaked");
          loadStakes();
        } catch (error) {
          console.error("Unstake failed:", error);
          alert("❌ Unstake failed.");
        }
      };
      card.appendChild(unstakeBtn);

      container.appendChild(card);
    });

    if (stakes.length === 0) {
      container.innerText = "No stakes found.";
    }
  } catch (e) {
    console.error("Error loading stakes:", e);
    container.innerText = "Failed to load stakes.";
  }
}

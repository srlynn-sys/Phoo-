import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCkT8J7ttr9w-ZJJmbyu6aT9qLCUmauXcA",
  authDomain: "my-k-pop-shop.firebaseapp.com",
  projectId: "my-k-pop-shop",
  storageBucket: "my-k-pop-shop.firebasestorage.app",
  messagingSenderId: "697172084426",
  appId: "1:697172084426:web:6fb0b4cf2cc1f57e291633"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TELEGRAM_BOT_TOKEN = "8997594636:AAGGXMgiTnbufcUozWn2yBW7XdfLnbLP4R8";
const TELEGRAM_USER_ID = "5050699658";

let currentCustomerName = "";
let selectedProduct = null;

function getStatusBadgeClass(status) {
  switch (status) {
    case "order စစ်ဆေးနေဆဲ": return "status-yellow";
    case "order လုပ်ဆောင်နေပါသည်": return "status-purple";
    case "order rejected": return "status-red";
    case "order completed": return "status-green";
    case "order ပို့ဆောင်နေပါသည်": return "status-blue";
    default: return "status-yellow";
  }
}

async function sendTelegramNotification(order) {
  const msg = `
🔔 *Order အသစ်ရောက်ရှိပါသည်*

🆔 *Order Code:* \`${order.orderCode}\`
👤 *အမည်:* ${order.customerName}
📞 *ဖုန်း:* ${order.phone || 'N/A'}
🚚 *ပို့ဆောင်ရေး:* ${order.deliveryType === 'pickup' ? 'ကိုယ့်တိုင် Pick-up လာယူမည်' : order.address}
💳 *ငွေရှင်းစနစ်:* ${order.paymentType.toUpperCase()}
💰 *ကျသင့်ငွေ:* ${order.totalAmount} Ks (Discount: ${order.discount} Ks)
📌 *Status:* ${order.status}
  `;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_USER_ID, text: msg, parse_mode: "Markdown" })
  });
}

document.addEventListener("DOMContentLoaded", () => {
  
  // Navigation Tabs
  const navShop = document.getElementById("nav-shop");
  const navChecker = document.getElementById("nav-checker");
  const shopFlow = document.getElementById("shop-flow");
  const pageChecker = document.getElementById("page-checker");

  if(navShop) {
    navShop.onclick = () => {
      navShop.classList.add("active");
      navChecker.classList.remove("active");
      shopFlow.classList.remove("hidden");
      pageChecker.classList.add("hidden");
    };
    navChecker.onclick = () => {
      navChecker.classList.add("active");
      navShop.classList.remove("active");
      pageChecker.classList.remove("hidden");
      shopFlow.classList.add("hidden");
    };
  }

  // Page Switcher Helper
  function showPage(pageId) {
    ["page-step-name", "page-catalog", "page-detail", "page-checkout"].forEach(id => {
      document.getElementById(id).classList.add("hidden");
    });
    document.getElementById(pageId).classList.remove("hidden");
  }

  // Step 1 -> Catalog
  const btnToCatalog = document.getElementById("btn-to-catalog");
  if(btnToCatalog) {
    btnToCatalog.onclick = () => {
      const name = document.getElementById("cust-name-input").value.trim();
      if(!name) return alert("နာမည် ရိုက်ထည့်ပေးပါ။");
      currentCustomerName = name;
      document.getElementById("display-cust-name").innerText = currentCustomerName;
      showPage("page-catalog");
      loadProducts();
    };
  }

  const btnChangeName = document.getElementById("btn-change-name");
  if(btnChangeName) btnChangeName.onclick = () => showPage("page-step-name");

  // Load Products Grid
  async function loadProducts() {
    const grid = document.getElementById("product-grid");
    grid.innerHTML = "Loading...";
    const snapshot = await getDocs(collection(db, "products"));
    grid.innerHTML = "";
    
    snapshot.forEach(doc => {
      const p = doc.data();
      const item = document.createElement("div");
      item.className = "product-card";
      item.innerHTML = `
        <img src="${p.showPhoto}" class="product-img" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
        <div class="product-title">${p.name}</div>
        <div class="product-price">${p.price} Ks</div>
      `;
      item.onclick = () => openDetailPage(p);
      grid.appendChild(item);
    });
  }

  // Open Detail Page
  function openDetailPage(p) {
    selectedProduct = p;
    document.getElementById("detail-title").innerText = p.name;
    document.getElementById("detail-price").innerText = `${p.price} Ks`;
    
    const imgsDiv = document.getElementById("detail-images");
    imgsDiv.innerHTML = `<img src="${p.showPhoto}" style="width:100%; height:200px; object-fit:cover; border-radius:18px;">`;
    if(p.detailPhotos && p.detailPhotos.length > 0) {
      p.detailPhotos.forEach(url => {
        if(url.trim()) imgsDiv.innerHTML += `<img src="${url.trim()}" style="width:100%; height:200px; object-fit:cover; border-radius:18px; margin-top:8px;">`;
      });
    }

    showPage("page-detail");
  }

  const btnBackToCatalog = document.getElementById("btn-back-to-catalog");
  if(btnBackToCatalog) btnBackToCatalog.onclick = () => showPage("page-catalog");

  // Detail -> Checkout Page
  const btnToCheckout = document.getElementById("btn-to-checkout");
  if(btnToCheckout) {
    btnToCheckout.onclick = () => {
      showPage("page-checkout");
      updateInvoiceSummary();
    };
  }

  const btnBackToDetail = document.getElementById("btn-back-to-detail");
  if(btnBackToDetail) btnBackToDetail.onclick = () => showPage("page-detail");

  // Select Listeners
  const selectDel = document.getElementById("select-delivery");
  const selectPay = document.getElementById("select-payment");
  
  if(selectDel) {
    selectDel.onchange = () => {
      if(selectDel.value === "delivery") document.getElementById("delivery-info-box").classList.remove("hidden");
      else document.getElementById("delivery-info-box").classList.add("hidden");
    };
  }

  if(selectPay) {
    selectPay.onchange = () => {
      if(selectPay.value === "online") document.getElementById("online-pay-info").classList.remove("hidden");
      else document.getElementById("online-pay-info").classList.add("hidden");
    };
  }

  function updateInvoiceSummary() {
    const qty = Number(document.getElementById("detail-qty").value) || 1;
    const subtotal = selectedProduct.price * qty;
    let discount = 0;
    if(subtotal >= 10000) discount = Math.floor(subtotal / 10000) * 500;
    const total = subtotal - discount;

    document.getElementById("sum-subtotal").innerText = `${subtotal} Ks`;
    document.getElementById("sum-discount").innerText = `-${discount} Ks`;
    document.getElementById("sum-total").innerText = `${total} Ks`;
  }

  // Confirm Order
  const btnConfirmOrder = document.getElementById("btn-confirm-order");
  if(btnConfirmOrder) {
    btnConfirmOrder.onclick = async () => {
      const delType = selectDel.value;
      const payType = selectPay.value;
      const address = document.getElementById("del-address").value;
      const phone = document.getElementById("del-phone").value;
      const payLink = document.getElementById("pay-screenshot-link").value;

      if(delType === "delivery" && (!address || !phone)) {
        return alert("Delivery ပို့ရန် လိပ်စာ နှင့် ဖုန်းနံပါတ် ဖြည့်ပေးပါ။");
      }

      const qty = Number(document.getElementById("detail-qty").value) || 1;
      const subtotal = selectedProduct.price * qty;
      let discount = 0;
      if(subtotal >= 10000) discount = Math.floor(subtotal / 10000) * 500;
      const totalAmount = subtotal - discount;
      const orderCode = "ORD-" + Math.floor(1000 + Math.random() * 9000);

      const newOrder = {
        orderCode,
        customerName: currentCustomerName,
        item: selectedProduct.name,
        qty,
        subtotal,
        discount,
        totalAmount,
        deliveryType: delType,
        address: delType === "delivery" ? address : "Pick-up လာယူမည်",
        phone: delType === "delivery" ? phone : "N/A",
        paymentType: payType,
        paymentScreenshot: payLink || "N/A",
        status: "order စစ်ဆေးနေဆဲ",
        createdAt: new Date()
      };

      await addDoc(collection(db, "orders"), newOrder);
      await sendTelegramNotification(newOrder);

      alert(`✨ Order တင်ခြင်း အောင်မြင်ပါသည်!\nသင့် Order Code: ${orderCode}`);
      showPage("page-catalog");
    };
  }

  // Checker
  const btnCheckStatus = document.getElementById("btn-check-status");
  if(btnCheckStatus) {
    btnCheckStatus.onclick = async () => {
      const code = document.getElementById("checker-code-input").value.trim();
      if(!code) return alert("Order Code ရိုက်ထည့်ပါ");

      const q = query(collection(db, "orders"), where("orderCode", "==", code));
      const snapshot = await getDocs(q);

      if(snapshot.empty) return alert("Order Code မတွေ့ရှိပါ။");

      snapshot.forEach(doc => {
        const data = doc.data();
        document.getElementById("checker-result").classList.remove("hidden");
        document.getElementById("res-code").innerText = data.orderCode;
        
        const badge = document.getElementById("res-status-badge");
        badge.innerText = data.status;
        badge.className = `badge ${getStatusBadgeClass(data.status)}`;

        document.getElementById("res-details").innerHTML = `
          <p style="margin-bottom:4px;"><b>ဝယ်ယူသည့် ပစ္စည်း:</b> ${data.item} (${data.qty} ခု)</p>
          <p><b>ကျသင့်ငွေ:</b> ${data.totalAmount} Ks</p>
        `;
      });
    };
  }

  // Admin Logic
  const btnAddProduct = document.getElementById("btn-add-product");
  if(btnAddProduct) {
    btnAddProduct.onclick = async () => {
      const name = document.getElementById("p-name").value;
      const price = Number(document.getElementById("p-price").value);
      const showPhoto = document.getElementById("p-show-img").value;
      const detailPhotos = document.getElementById("p-detail-imgs").value.split(",");

      if(!name || !price || !showPhoto) return alert("အချက်အလက် အပြည့်အစုံ ဖြည့်ပါ။");

      await addDoc(collection(db, "products"), { name, price, showPhoto, detailPhotos });
      alert("ပစ္စည်း တင်ပြီးပါပြီ!");
      location.reload();
    };

    async function loadAdminOrders() {
      const container = document.getElementById("admin-orders-list");
      const snapshot = await getDocs(collection(db, "orders"));
      container.innerHTML = "";

      snapshot.forEach(docSnap => {
        const order = docSnap.data();
        const docId = docSnap.id;

        const card = document.createElement("div");
        card.style.background = "#faf5ff";
        card.style.padding = "14px";
        card.style.borderRadius = "16px";
        card.style.marginBottom = "12px";
        card.style.border = "1px solid #e9d5ff";
        
        card.innerHTML = `
          <p style="font-size:0.9rem;"><b>Code:</b> ${order.orderCode} | <b>Name:</b> ${order.customerName}</p>
          <p style="font-size:0.9rem; margin:4px 0;"><b>Item:</b> ${order.item} (${order.qty}ခု) | <b>Total:</b> ${order.totalAmount} Ks</p>
          <p style="font-size:0.85rem; margin-bottom:8px;"><b>Pay Slip:</b> ${order.paymentScreenshot !== 'N/A' ? `<a href="${order.paymentScreenshot}" target="_blank">ကြည့်ရန်</a>` : 'မရှိပါ'}</p>
          
          <select id="status-sel-${docId}" class="input-modern" style="padding:8px; font-size:0.85rem; margin-bottom:6px;">
            <option value="order စစ်ဆေးနေဆဲ" ${order.status === "order စစ်ဆေးနေဆဲ" ? "selected" : ""}>order စစ်ဆေးနေဆဲ</option>
            <option value="order လုပ်ဆောင်နေပါသည်" ${order.status === "order လုပ်ဆောင်နေပါသည်" ? "selected" : ""}>order လုပ်ဆောင်နေပါသည်</option>
            <option value="order rejected" ${order.status === "order rejected" ? "selected" : ""}>order rejected</option>
            <option value="order completed" ${order.status === "order completed" ? "selected" : ""}>order completed</option>
            <option value="order ပို့ဆောင်နေပါသည်" ${order.status === "order ပို့ဆောင်နေပါသည်" ? "selected" : ""}>order ပို့ဆောင်နေပါသည်</option>
          </select>
          <button class="btn-primary" style="padding:10px; font-size:0.85rem;" onclick="updateOrderStatus('${docId}')">Save Status</button>
        `;
        container.appendChild(card);
      });
    }

    window.updateOrderStatus = async (docId) => {
      const selValue = document.getElementById(`status-sel-${docId}`).value;
      await updateDoc(doc(db, "orders", docId), { status: selValue });
      alert("Status ပြင်ဆင်ပြီးပါပြီ!");
    };

    loadAdminOrders();
  }

});

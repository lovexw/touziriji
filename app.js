const CONFIG = {
    TRANSACTIONS_KEY: 'btc_transactions',
    PRICE_API: 'https://api.coinbase.com/v2/prices/BTC-USD/spot',
    PRICE_UPDATE_INTERVAL: 60000,
};

let currentBTCPrice = 0;
let priceUpdateTimer = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaction-date').value = today;

    document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);

    document.getElementById('import-file-input').addEventListener('change', handleFileImport);
});

function initApp() {
    updateBTCPrice();
    renderTransactions();
    updateStatistics();
    
    // 定期更新价格
    priceUpdateTimer = setInterval(updateBTCPrice, CONFIG.PRICE_UPDATE_INTERVAL);
}

// 获取比特币实时价格
async function updateBTCPrice() {
    try {
        const response = await fetch(CONFIG.PRICE_API);
        const data = await response.json();
        currentBTCPrice = parseFloat(data.data.amount);
        
        document.getElementById('btc-price').textContent = `$${currentBTCPrice.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
        
        const now = new Date();
        document.getElementById('price-update').textContent = `更新时间：${now.toLocaleString('zh-CN')}`;
        
        // 价格更新后重新计算统计数据
        updateStatistics();
    } catch (error) {
        console.error('获取比特币价格失败:', error);
        document.getElementById('btc-price').textContent = '获取失败';
        document.getElementById('price-update').textContent = '请检查网络连接';
    }
}

// 获取所有交易
function getTransactions() {
    const data = localStorage.getItem(CONFIG.TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
}

// 保存交易
function saveTransactions(transactions) {
    localStorage.setItem(CONFIG.TRANSACTIONS_KEY, JSON.stringify(transactions));
}

// 添加交易
function handleTransactionSubmit(e) {
    e.preventDefault();

    const transaction = {
        id: Date.now().toString(),
        type: document.getElementById('transaction-type').value,
        date: document.getElementById('transaction-date').value,
        price: parseFloat(document.getElementById('transaction-price').value),
        amount: parseFloat(document.getElementById('transaction-amount').value),
        note: document.getElementById('transaction-note').value,
        timestamp: Date.now()
    };

    const transactions = getTransactions();
    transactions.push(transaction);
    saveTransactions(transactions);

    // 重置表单
    document.getElementById('transaction-form').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaction-date').value = today;

    // 更新界面
    renderTransactions();
    updateStatistics();
}

// 删除交易
function deleteTransaction(id) {
    if (confirm('确定要删除这条交易记录吗？')) {
        let transactions = getTransactions();
        transactions = transactions.filter(t => t.id !== id);
        saveTransactions(transactions);
        renderTransactions();
        updateStatistics();
    }
}

// 应用筛选
function applyFilters() {
    renderTransactions();
}

// 渲染交易列表
function renderTransactions() {
    let transactions = getTransactions();
    const container = document.getElementById('transactions-list');

    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无交易记录</p>';
        return;
    }

    const filterType = document.getElementById('filter-type')?.value || 'all';
    const filterSort = document.getElementById('filter-sort')?.value || 'date-desc';

    // 按类型筛选
    if (filterType !== 'all') {
        transactions = transactions.filter(t => t.type === filterType);
    }

    // 排序
    switch (filterSort) {
        case 'date-asc':
            transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'date-desc':
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'amount-asc':
            transactions.sort((a, b) => (a.price * a.amount) - (b.price * b.amount));
            break;
        case 'amount-desc':
            transactions.sort((a, b) => (b.price * b.amount) - (a.price * a.amount));
            break;
    }

    if (transactions.length === 0) {
        container.innerHTML = '<p class="empty-state">无符合条件的交易记录</p>';
        return;
    }

    container.innerHTML = transactions.map(t => {
        const totalCost = (t.price * t.amount).toFixed(2);
        const typeText = t.type === 'buy' ? '买入' : '卖出';
        const typeClass = t.type === 'buy' ? 'buy' : 'sell';

        return `
            <div class="transaction-item">
                <div class="transaction-header">
                    <span class="transaction-type ${typeClass}">${typeText}</span>
                    <span class="transaction-date">${formatDate(t.date)}</span>
                </div>
                <div class="transaction-details">
                    <div class="detail-item">
                        <span class="detail-label">价格</span>
                        <span class="detail-value">$${t.price.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">数量</span>
                        <span class="detail-value">${t.amount.toFixed(8)} BTC</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">总额</span>
                        <span class="detail-value">$${parseFloat(totalCost).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        })}</span>
                    </div>
                </div>
                ${t.note ? `
                    <div class="transaction-note">
                        <p>${escapeHtml(t.note)}</p>
                    </div>
                ` : ''}
                <div class="transaction-actions">
                    <button class="btn-delete" onclick="deleteTransaction('${t.id}')">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

// 更新统计数据
function updateStatistics() {
    const transactions = getTransactions();
    
    let totalHoldings = 0;
    let totalInvested = 0;
    let totalSold = 0;

    transactions.forEach(t => {
        if (t.type === 'buy') {
            totalHoldings += t.amount;
            totalInvested += t.price * t.amount;
        } else {
            totalHoldings -= t.amount;
            totalSold += t.price * t.amount;
        }
    });

    // 平均成本（只计算买入）
    const buyTransactions = transactions.filter(t => t.type === 'buy');
    const totalBuyAmount = buyTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalBuyCost = buyTransactions.reduce((sum, t) => sum + (t.price * t.amount), 0);
    const avgCost = totalBuyAmount > 0 ? totalBuyCost / totalBuyAmount : 0;

    // 当前市值
    const currentValue = totalHoldings * currentBTCPrice;

    // 净投入（总投入 - 卖出收入）
    const netInvested = totalInvested - totalSold;

    // 账面收益
    const profit = currentValue - netInvested;
    const profitPercent = netInvested > 0 ? (profit / netInvested) * 100 : 0;

    // 更新界面
    document.getElementById('total-holdings').textContent = `${totalHoldings.toFixed(8)} BTC`;
    document.getElementById('avg-cost').textContent = `$${avgCost.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
    document.getElementById('total-invested').textContent = `$${netInvested.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
    document.getElementById('current-value').textContent = `$${currentValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    const profitElement = document.getElementById('profit');
    const profitText = `$${profit.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`;
    
    profitElement.textContent = profitText;
    profitElement.style.color = profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
}

// 导出数据
function exportData() {
    const transactions = getTransactions();
    const dataStr = JSON.stringify(transactions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `btc-journal-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// 导入数据
function importData() {
    document.getElementById('import-file-input').click();
}

// 处理文件导入
function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const transactions = JSON.parse(event.target.result);
            if (Array.isArray(transactions)) {
                if (confirm(`将导入 ${transactions.length} 条记录。这将覆盖现有数据，确定继续吗？`)) {
                    saveTransactions(transactions);
                    renderTransactions();
                    updateStatistics();
                    alert('导入成功！');
                }
            } else {
                alert('文件格式错误');
            }
        } catch (error) {
            alert('导入失败：文件格式不正确');
            console.error('导入错误:', error);
        }
    };
    reader.readAsText(file);
    
    // 重置文件输入
    e.target.value = '';
}

// 清空所有数据
function clearAllData() {
    if (confirm('警告：此操作将删除所有交易记录，且无法恢复。确定继续吗？')) {
        if (confirm('再次确认：真的要删除所有数据吗？')) {
            localStorage.removeItem(CONFIG.TRANSACTIONS_KEY);
            renderTransactions();
            updateStatistics();
            alert('所有数据已清空');
        }
    }
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

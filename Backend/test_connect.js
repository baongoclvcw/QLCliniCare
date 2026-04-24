// Test đăng nhập API
// File này để demo cách API đăng nhập hoạt động

const testLogin = async () => {
    try {
        // Giả lập request body từ frontend
        const loginData = {
            email: "patient@example.com",
            password: "123456"
        };

        console.log("🔐 Đang đăng nhập với:", loginData);

        // Gọi API đăng nhập
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();

        if (response.ok) {
            console.log("✅ Đăng nhập thành công!");
            console.log("📝 Token:", result.token);
            console.log("👤 User info:", result.user);
        } else {
            console.log("❌ Đăng nhập thất bại:", result.message);
        }

    } catch (error) {
        console.error("🚨 Lỗi:", error.message);
    }
};

// Chạy test
testLogin();
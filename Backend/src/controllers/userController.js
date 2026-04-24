exports.getUserProfile = async (req, res) => {
    try {
        const { ma_tai_khoan } = req.query; // Sau này dùng Token thì lấy từ req.user
        const [user] = await sequelize.query(`
            SELECT nd.ho_ten, tk.ma_vai_tro 
            FROM Tai_khoan tk
            JOIN Thong_tin_nguoi_dung nd ON tk.ma_tai_khoan = nd.ma_tai_khoan
            WHERE tk.ma_tai_khoan = :ma_tai_khoan
        `, { replacements: { ma_tai_khoan }, type: QueryTypes.SELECT });

        if (!user) return res.status(404).json({ message: "Không tìm thấy user" });
        res.json(user);
    } catch (error) { res.status(500).json({ message: error.message }); }
};
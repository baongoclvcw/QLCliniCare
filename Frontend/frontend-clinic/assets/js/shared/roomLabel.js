/**
 * Nhãn hiển thị phòng khám: Phòng {ma_phong} - {ten_phong}
 */
function formatClinicRoomLabel(maPhong, tenPhong) {
  const ma = maPhong != null ? String(maPhong).trim() : "";
  const ten = tenPhong != null ? String(tenPhong).trim() : "";
  if (ma && ten) return `Phòng ${ma} - ${ten}`;
  if (ma) return `Phòng ${ma}`;
  if (ten) return /^phòng\s/i.test(ten) ? ten : `Phòng ${ten}`;
  return "";
}

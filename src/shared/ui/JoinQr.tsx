import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
export default function JoinQr({ url }: { url: string }) {
  const [data, setData] = useState('');
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 180, margin: 2 })
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setData('');
      });
    return () => {
      active = false;
    };
  }, [url]);
  return data ? (
    <img src={data} width={180} height={180} alt="QR-код для подключения участников" />
  ) : null;
}

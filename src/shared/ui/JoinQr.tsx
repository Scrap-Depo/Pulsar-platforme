import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
export default function JoinQr({
  url,
  downloadable = false,
}: {
  url: string;
  downloadable?: boolean;
}) {
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
    <div className="join-qr">
      <img src={data} width={180} height={180} alt="QR-код для подключения участников" />
      {downloadable && (
        <button
          type="button"
          onClick={() => {
            void QRCode.toDataURL(url, { width: 1000, margin: 2 })
              .then((png) => {
                const link = document.createElement('a');
                link.href = png;
                link.download = `pulsar-qr-${new URL(url).searchParams.get('code') || 'meeting'}.png`;
                link.click();
              })
              .catch(() => window.alert('Не удалось подготовить QR. Повторите попытку.'));
          }}
        >
          Скачать QR PNG
        </button>
      )}
    </div>
  ) : null;
}

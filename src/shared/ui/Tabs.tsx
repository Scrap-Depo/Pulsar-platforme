type TabsProps<T extends string> = {
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
};

export default function Tabs<T extends string>({ items, value, onChange }: TabsProps<T>) {
  return (
    <div className="button-row">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className="card"
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            borderColor: value === item.value ? 'rgba(56, 189, 248, 0.6)' : undefined,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

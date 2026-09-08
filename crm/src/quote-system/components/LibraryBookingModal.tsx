import { useState } from "react";
import { bookingValid, type BookingDraft } from "../lib/quoteLibrary";
import { LibraryBookingForm } from "./LibraryBookingForm";
import { Modal } from "./Modal";
export function LibraryBookingModal({ initial, onClose, onSave }: {
    initial: BookingDraft;
    onClose: () => void;
    onSave: (value: BookingDraft) => void;
}) {
    const [value, setValue] = useState(initial);
    return <Modal wide title="编辑报价产品与规格" onClose={onClose} footer={<><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!bookingValid(value)} onClick={() => onSave(value)}>确认保存</button></>}>
    <label>项目名称<input value={value.nameZh} onChange={e => setValue({ ...value, nameZh: e.target.value })}/></label>
    <LibraryBookingForm value={value} onChange={setValue}/>
  </Modal>;
}

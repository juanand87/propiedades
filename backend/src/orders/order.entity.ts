import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Customer } from '../customers/customer.entity';
import { OrderItem } from './order-item.entity';
import { OrderShipment } from './order-shipment.entity';
import { OrderRefund } from './order-refund.entity';
import { clpTransformer } from '../common/transformers/clp.transformer';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  TRANSFER = 'transfer',
  CASH = 'cash',
  FLOW = 'flow',
}

@Index(['vendorId', 'orderSource', 'checkoutSessionId'], { unique: true })
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderNumber: string;

  @Column({ name: 'checkout_session_id', type: 'varchar', length: 100, nullable: true })
  checkoutSessionId: string;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 0, transformer: clpTransformer })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 0, default: 0, transformer: clpTransformer })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 0, default: 0, transformer: clpTransformer })
  tax: number;

  @Column({ type: 'decimal', precision: 10, scale: 0, transformer: clpTransformer })
  total: number;

  @Column({ nullable: true })
  vendorId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  vendorSlug: string;

  @Column({ type: 'varchar', length: 50 })
  paymentMethod: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentStatus: string;

  @Column({ type: 'boolean', default: false })
  confirmationEmailSent: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  paymentTransactionId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  paymentUrl: string;

  @Column({ nullable: true })
  paymentId: string;

  @Column({ name: 'sales_receipt_url', type: 'text', nullable: true })
  salesReceiptUrl: string | null;

  @Column({ name: 'sales_receipt_qr_image_url', type: 'text', nullable: true })
  salesReceiptQrImageUrl: string | null;

  @Column({ name: 'sales_receipt_token', type: 'varchar', length: 32, nullable: true, unique: true })
  salesReceiptToken: string | null;

  // Customer email
  @Column({ type: 'varchar', length: 255, nullable: true })
  customerEmail: string;

  // Dirección de envío
  @Column()
  shippingName: string;

  @Column()
  shippingAddress: string;

  @Column({ nullable: true })
  shippingNumber: string;

  @Column()
  shippingCity: string;

  @Column()
  shippingCountry: string;

  @Column({ nullable: true })
  shippingRegion: string;

  @Column({ nullable: true })
  shippingRegionId: number;

  @Column({ nullable: true })
  shippingCommune: string;

  @Column({ nullable: true })
  shippingCommuneId: number;

  @Column()
  shippingRut: string;

  @Column()
  shippingPhone: string;

  @Column({ nullable: true })
  shippingMethod: string;

  @Column({ nullable: true })
  shippingMethodCode: string;

  @Column({ nullable: true })
  estimatedDeliveryDays: number;

  @Column({ nullable: true })
  trackingNumber: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Payku Marketplace Split Fields
  @Column({ type: 'varchar', length: 255, nullable: true })
  vendorEmail: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  marketplaceEmail: string;

  @Column({ type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  vendorAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  marketplaceCommission: number;

  @Column({ type: 'text', nullable: true })
  splitDetails: string;

  // Marketplace Commission Tracking (nullable for backward compatibility)
  @Column({ type: 'varchar', length: 50, nullable: true, default: 'direct_store' })
  orderSource: string; // 'marketplace', 'direct_store', 'custom_domain', 'mercadolibre'

  @Column({ name: 'assisted_sale_status', type: 'varchar', length: 40, nullable: true })
  assistedSaleStatus: string | null;

  @Column({ name: 'assisted_sale_channel', type: 'varchar', length: 30, nullable: true })
  assistedSaleChannel: string | null;

  @Column({ name: 'customer_transfer_reference', type: 'varchar', length: 255, nullable: true })
  customerTransferReference: string | null;

  @Column({ name: 'customer_transfer_confirmed_at', type: 'datetime', nullable: true })
  customerTransferConfirmedAt: Date | null;

  @Column({ name: 'platform_charge_amount', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  platformChargeAmount: number | null;

  @Column({ name: 'assisted_reimbursement_status', type: 'varchar', length: 40, nullable: true })
  assistedReimbursementStatus: string | null;

  @Column({ name: 'assisted_shipping_refund_status', type: 'varchar', length: 40, nullable: true })
  assistedShippingRefundStatus: string | null;

  @Column({ name: 'assisted_commission_refund_amount', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  assistedCommissionRefundAmount: number | null;

  @Column({ name: 'assisted_shipping_refund_amount', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  assistedShippingRefundAmount: number | null;

  @Column({ name: 'assisted_reimbursement_amount', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  assistedReimbursementAmount: number | null;

  @Column({ name: 'assisted_shipping_cancellation_confirmed_at', type: 'datetime', nullable: true })
  assistedShippingCancellationConfirmedAt: Date | null;

  @Index()
  @Column({ name: 'pos_register_id', type: 'varchar', length: 36, nullable: true })
  posRegisterId: string | null;

  @Index()
  @Column({ name: 'pos_staff_id', type: 'varchar', length: 36, nullable: true })
  posStaffId: string | null;

  @Index()
  @Column({ name: 'pos_shift_id', type: 'varchar', length: 36, nullable: true })
  posShiftId: string | null;

  @Column({ name: 'external_order_id', type: 'varchar', length: 100, nullable: true })
  externalOrderId: string | null;

  @Column({ name: 'external_shipping_id', type: 'varchar', length: 100, nullable: true })
  externalShippingId: string | null;

  @Column({ name: 'external_shipping_status', type: 'varchar', length: 80, nullable: true })
  externalShippingStatus: string | null;

  @Column({ name: 'external_order_data', type: 'json', nullable: true })
  externalOrderData: any | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  isMarketplaceSale: boolean; // Indicador explícito de venta del marketplace

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, default: 0 })
  commissionPercentage: number; // % de comisión aplicado (snapshot)

  @Column({ type: 'decimal', precision: 10, scale: 0, nullable: true, default: 0, transformer: clpTransformer })
  commissionAmount: number; // Monto de comisión calculado

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'pending' })
  commissionStatus: string; // 'pending', 'paid', 'cancelled'

  @Column({ type: 'boolean', nullable: true, default: false })
  isWholesaleOrder: boolean; // Si es una orden mayorista

  // SendU Integration Fields
  @Column({ name: 'sendu_work_order_id', nullable: true })
  senduWorkOrderId: number;

  @Column({ name: 'sendu_courier_id', nullable: true })
  senduCourierId: number;

  @Column({ name: 'sendu_courier_ot', nullable: true, length: 255 })
  senduCourierOt: string;

  @Column({ name: 'sendu_label_url', type: 'text', nullable: true })
  senduLabelUrl: string;

  @Column({ name: 'sendu_tracking_url', type: 'text', nullable: true })
  senduTrackingUrl: string;

  @Column({ name: 'sendu_quotation_id', nullable: true })
  senduQuotationId: number;

  @Column({ name: 'sendu_shipping_cost', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  senduShippingCost: number;

  @Column({ name: 'sendu_created_at', type: 'timestamp', nullable: true })
  senduCreatedAt: Date;

  // Envia.com Integration Fields
  @Column({ name: 'envia_carrier', nullable: true, length: 50 })
  enviaCarrier: string; // chilexpress, correoschile, etc.

  @Column({ name: 'envia_service', nullable: true, length: 100 })
  enviaService: string; // express, normal, etc.

  @Column({ name: 'envia_service_description', nullable: true, length: 255 })
  enviaServiceDescription: string;

  @Column({ name: 'envia_quoted_price', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  enviaQuotedPrice: number; // Precio cotizado en checkout

  @Column({ name: 'envia_final_price', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  enviaFinalPrice: number; // Precio real al generar etiqueta

  @Column({ name: 'envia_shipment_id', nullable: true, length: 100 })
  enviaShipmentId: string;

  @Column({ name: 'envia_tracking_number', nullable: true, length: 100 })
  enviaTrackingNumber: string;

  @Column({ name: 'envia_label_url', type: 'text', nullable: true })
  enviaLabelUrl: string;

  @Column({ name: 'envia_tracking_url', type: 'text', nullable: true })
  enviaTrackingUrl: string;

  @Column({ name: 'envia_shipping_status', nullable: true, length: 50 })
  enviaShippingStatus: string; // pending, generated, picked_up, in_transit, delivered

  @Column({ name: 'envia_label_generated_at', type: 'timestamp', nullable: true })
  enviaLabelGeneratedAt: Date;

  @Column({ name: 'envia_last_tracking_update', type: 'timestamp', nullable: true })
  enviaLastTrackingUpdate: Date;

  @Column({ name: 'shipping_handled_by', type: 'varchar', length: 30, nullable: true })
  shippingHandledBy: string | null;

  @Column({ name: 'external_shipping_reason', type: 'varchar', length: 50, nullable: true })
  externalShippingReason: string | null;

  @Column({ name: 'external_shipping_reason_detail', type: 'text', nullable: true })
  externalShippingReasonDetail: string | null;

  @Column({ name: 'external_shipping_evidence_url', type: 'text', nullable: true })
  externalShippingEvidenceUrl: string | null;

  @Column({ name: 'external_shipping_carrier', type: 'varchar', length: 120, nullable: true })
  externalShippingCarrier: string | null;

  @Column({ name: 'external_shipping_tracking_url', type: 'text', nullable: true })
  externalShippingTrackingUrl: string | null;

  @Column({ name: 'external_shipping_selected_at', type: 'datetime', nullable: true })
  externalShippingSelectedAt: Date | null;

  @Column({ name: 'external_shipping_payout_amount', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  externalShippingPayoutAmount: number | null;

  @Column({ name: 'external_shipping_payout_status', type: 'varchar', length: 30, nullable: true })
  externalShippingPayoutStatus: string | null;

  @Column({ name: 'external_shipping_released_at', type: 'datetime', nullable: true })
  externalShippingReleasedAt: Date | null;

  @Column({ nullable: true })
  customerId: string;

  // Guest checkout data (temporary until account is created)
  @Column({ type: 'json', nullable: true })
  guestData: {
    name: string;
    email: string;
    phone: string;
    rut: string;
    address: string;
    commune: string;
    region: string;
  } | null;

  // Vendor Payment tracking
  @Column({ type: 'varchar', length: 36, nullable: true })
  vendorPaymentId: string | null;

  @Column({ type: 'datetime', nullable: true })
  vendorPaidAt: Date | null;

  // Cancellation tracking
  @Column({ type: 'varchar', length: 100, nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationNote: string | null;

  @Column({ type: 'datetime', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  cancelledById: string | null;

  @Column({ type: 'datetime', nullable: true })
  cancellationStockRestoredAt: Date | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  cancellationReviewStatus: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationReviewNote: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  cancellationReviewedById: string | null;

  @Column({ type: 'datetime', nullable: true })
  cancellationReviewedAt: Date | null;

  @Column({ name: 'cancellation_verification_url', type: 'text', nullable: true })
  cancellationVerificationUrl: string | null;

  @Column({ type: 'datetime', nullable: true })
  cancellationWarningSentAt: Date | null;

  // Devolución al comprador realizada por la tienda. Los registros de
  // order_refunds corresponden al flujo Payku anterior y se conservan como historial.
  @Column({ name: 'vendor_customer_refund_status', type: 'varchar', length: 30, nullable: true })
  vendorCustomerRefundStatus: string | null;

  @Column({ name: 'vendor_customer_refund_amount', type: 'decimal', precision: 10, scale: 0, nullable: true, transformer: clpTransformer })
  vendorCustomerRefundAmount: number | null;

  @Column({ name: 'vendor_customer_refund_reference', type: 'varchar', length: 255, nullable: true })
  vendorCustomerRefundReference: string | null;

  @Column({ name: 'vendor_customer_refund_proof', type: 'text', nullable: true })
  vendorCustomerRefundProof: string | null;

  @Column({ name: 'vendor_customer_refund_note', type: 'text', nullable: true })
  vendorCustomerRefundNote: string | null;

  @Column({ name: 'vendor_customer_refunded_at', type: 'datetime', nullable: true })
  vendorCustomerRefundedAt: Date | null;

  @Column({ name: 'abandoned_reminder_sent_at', type: 'datetime', nullable: true })
  abandonedReminderSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.orders, { nullable: true })
  customer: User;

  @ManyToOne(() => Customer, (customer) => customer.orders, { nullable: true })
  @JoinColumn({ name: 'guest_customer_id' })
  guestCustomer: Customer;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => OrderShipment, (shipment) => shipment.order, { cascade: true })
  shipments: OrderShipment[];

  @OneToOne(() => OrderRefund, (refund) => refund.order)
  refund: OrderRefund | null;
}

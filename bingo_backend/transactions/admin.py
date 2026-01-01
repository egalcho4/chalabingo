from django.contrib import admin
from django.utils.html import format_html
from .models import (
    PaymentAccount, Wallet, Deposit, 
    WithdrawRequest, Transaction
)

@admin.register(PaymentAccount)
class PaymentAccountAdmin(admin.ModelAdmin):
    list_display = [
        'payment_method', 'account_name', 'account_number', 
        'phone_number', 'is_active', 'min_amount', 'max_amount'
    ]
    list_filter = ['payment_method', 'is_active']
    search_fields = ['account_name', 'account_number', 'phone_number', 'bank_name']
    list_editable = ['is_active']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('የክፍያ መረጃ', {
            'fields': ('payment_method', 'account_name', 'account_number', 'phone_number', 'bank_name')
        }),
        ('ተጨማሪ መረጃ', {
            'fields': ('qr_code', 'instructions', 'min_amount', 'max_amount', 'is_active')
        }),
        ('ጊዜ', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def view_qr_code(self, obj):
        if obj.qr_code:
            return format_html(f'<img src="{obj.qr_code.url}" width="100" height="100" />')
        return "ምንም QR ኮድ የለም"
    
    view_qr_code.short_description = 'QR ኮድ'

@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['user', 'balance', 'updated_at']
    list_filter = ['updated_at']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-balance']

@admin.register(Deposit)
class DepositAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'amount', 'payment_account', 'status', 
        'created_at', 'processed_by'
    ]
    list_filter = ['status', 'created_at', 'payment_account__payment_method']
    search_fields = ['user__username', 'account_number', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']
    actions = ['approve_selected', 'reject_selected']
    
    fieldsets = (
        ('የአስገባት መረጃ', {
            'fields': ('user', 'amount', 'payment_account', 'status')
        }),
        ('የተጠቃሚ መረጃ', {
            'fields': ('account_name', 'account_number', 'phone_number', 'proof_image')
        }),
        ('አስተዳደር', {
            'fields': ('admin_notes', 'processed_by')
        }),
        ('ጊዜ', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def approve_selected(self, request, queryset):
        for deposit in queryset.filter(status='pending'):
            deposit.approve(request.user, 'በአስተዳዳሪ ተፈቅዷል')
        self.message_user(request, f"{queryset.count()} አስገባት(ዎች) ተፈቅደዋል")
    
    def reject_selected(self, request, queryset):
        for deposit in queryset.filter(status='pending'):
            deposit.reject(request.user, 'በአስተዳዳሪ ውድቅ ተደርጓል')
        self.message_user(request, f"{queryset.count()} አስገባት(ዎች) ውድቅ ተደርጓል")
    
    approve_selected.short_description = "በተመረጡት አስገባቶች ላይ ፈቅድ"
    reject_selected.short_description = "በተመረጡት አስገባቶች ላይ እፈቅዳለሁ"

@admin.register(WithdrawRequest)
class WithdrawRequestAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'amount', 'payment_account', 'status', 
        'account_number', 'created_at', 'processed_by'
    ]
    list_filter = ['status', 'created_at', 'payment_account__payment_method']
    search_fields = ['user__username', 'account_number', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']
    actions = ['approve_selected', 'reject_selected']
    
    fieldsets = (
        ('የጥያቄ መረጃ', {
            'fields': ('user', 'amount', 'payment_account', 'status')
        }),
        ('የተጠቃሚ መረጃ', {
            'fields': ('account_name', 'account_number', 'phone_number')
        }),
        ('አስተዳደር', {
            'fields': ('admin_notes', 'processed_by')
        }),
        ('ጊዜ', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def approve_selected(self, request, queryset):
        for withdraw in queryset.filter(status='pending'):
            withdraw.approve(request.user, 'በአስተዳዳሪ ተፈቅዷል')
        self.message_user(request, f"{queryset.count()} የገንዘብ ማውጣት ጥያቄ(ዎች) ተፈቅደዋል")
    
    def reject_selected(self, request, queryset):
        for withdraw in queryset.filter(status='pending'):
            withdraw.reject(request.user, 'በአስተዳዳሪ ውድቅ ተደርጓል')
        self.message_user(request, f"{queryset.count()} የገንዘብ ማውጣት ጥያቄ(ዎች) ውድቅ ተደርጓል")
    
    approve_selected.short_description = "በተመረጡት ጥያቄዎች ላይ ፈቅድ"
    reject_selected.short_description = "በተመረጡት ጥያቄዎች ላይ እፈቅዳለሁ"

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['user', 'amount', 'transaction_type', 'status', 'created_at']
    list_filter = ['transaction_type', 'status', 'created_at']
    search_fields = ['user__username', 'description', 'reference_id']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 50
    
    fieldsets = (
        ('የግብይት መረጃ', {
            'fields': ('user', 'amount', 'transaction_type', 'status')
        }),
        ('ተጨማሪ መረጃ', {
            'fields': ('description', 'reference_id')
        }),
        ('ጊዜ', {
            'fields': ('created_at', 'updated_at')
        }),
    )
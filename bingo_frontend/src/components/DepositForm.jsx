import React, { useState } from 'react';
import { transactionsAPI } from '../api/transactions';
import './DepositForm.css';

const DepositForm = () => {
  const [amount, setAmount] = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || !proofImage) {
      setMessage('እባክዎ መጠን እና የክፍያ ማስረጃ ያስገቡ');
      return;
    }
    
    setIsSubmitting(true);
    setMessage('');
    
    try {
      const formData = new FormData();
      formData.append('amount', amount);
      formData.append('proof_image', proofImage);
      
      const response = await transactionsAPI.createDeposit(formData);
      
      setMessage('የእርስዎ አስገባት ቀርቧል! ለመፍቀድ በጥበቃ ላይ ነው።');
      setAmount('');
      setProofImage(null);
      setPreviewUrl(null);
      e.target.reset();
    } catch (error) {
      setMessage(error.response?.data?.error || 'ስህተት ተከስቷል');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="deposit-form">
      <h2>ገንዘብ አስገባ</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="amount">መጠን (ብር)</label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="10"
            max="10000"
            step="10"
            required
            placeholder="የሚገቡትን መጠን ያስገቡ"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="proofImage">የክፍያ ማስረጃ (ምስል)</label>
          <input
            type="file"
            id="proofImage"
            accept="image/*"
            onChange={handleImageChange}
            required
          />
          <small>እባክዎ የባንክ ማስገቢያ ወይም የሞባይል ብር ማስገቢያ ምስል ይስጡ</small>
        </div>
        
        {previewUrl && (
          <div className="image-preview">
            <img src={previewUrl} alt="Preview" />
          </div>
        )}
        
        {message && (
          <div className={`message ${message.includes('ቀርቧል') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
        
        <button 
          type="submit" 
          className="btn-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'በላክ ላይ...' : 'አስገባ'}
        </button>
      </form>
      
      <div className="deposit-instructions">
        <h3>የክፍያ መንገዶች</h3>
        <ul>
          <li><strong>ባንክ አካውንት:</strong> 1000XXXXXXXX | አባል ባንክ</li>
          <li><strong>ሞባይል ብር:</strong> 09XXXXXXXX | የኢትዮፕ ቴሌኮም</li>
          <li><strong>ሌላ:</strong> CBE ቢር</li>
        </ul>
        <p className="note">
          እባክዎ ክፍያ ካደረጉ በኋላ የክፍያ ማስረጃ ምስል ይስጡ። ክፍያው ከተፈቀደ በኋላ ገንዘቡ ወደ ቦርሳዎ ይጨመራል።
        </p>
      </div>
    </div>
  );
};

export default DepositForm;
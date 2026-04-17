import { Routes, Route, useNavigate } from 'react-router-dom';
import LeadsList from '@/components/leads/LeadsList';
import LeadDetail from '@/components/leads/LeadDetail';
import NewLeadForm from '@/components/leads/NewLeadForm';

export default function Leads() {
  return (
    <div>
      <LeadsList />
    </div>
  );
}

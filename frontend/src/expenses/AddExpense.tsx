import { Button } from "@coinbase/cdp-react/components/ui/Button";
import { useState } from "react";

/**
 * Component for adding a new expense
 */
function AddExpense() {
  const [isOpen, setIsOpen] = useState(false);

  const handleAddExpense = () => {
    setIsOpen(true);
    // TODO: Implement expense creation logic
    console.log("Add expense clicked");
  };

  return (
    <div className="card card--add-expense">
      <h2 className="card-title">Add Expense</h2>
      <p>Create a new expense to split with your friends.</p>
      <Button
        type="button"
        onClick={handleAddExpense}
        className="tx-button"
      >
        Add Expense
      </Button>
    </div>
  );
}

export default AddExpense;


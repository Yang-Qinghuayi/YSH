import { styled } from 'nativewind';
import { Text as PaperText } from 'react-native-paper';

// Resolve utility classes before entering Paper, so semantic color and spacing
// become its public `style` prop rather than being shadowed by Paper's defaults.
export const Text = styled(PaperText, { className: 'style' });

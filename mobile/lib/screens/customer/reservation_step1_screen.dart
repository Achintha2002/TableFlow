import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/routes.dart';

class ReservationStep1Screen extends StatefulWidget {
  const ReservationStep1Screen({super.key});

  @override
  State<ReservationStep1Screen> createState() => _ReservationStep1ScreenState();
}

class _ReservationStep1ScreenState extends State<ReservationStep1Screen> {
  String _selectedRestaurant = 'The Green Table';
  DateTime _selectedDate = DateTime.now();
  TimeOfDay _selectedTime = const TimeOfDay(hour: 19, minute: 0);
  int _numberOfGuests = 4;

  final List<String> _restaurants = [
    'The Green Table',
    'TableFlow Bistro & Lounge',
    'The Terrace Garden'
  ];

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFB87F5C),
              onPrimary: Colors.white,
              onSurface: Color(0xFF1E1E1E),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFB87F5C),
              onPrimary: Colors.white,
              onSurface: Color(0xFF1E1E1E),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedTime = picked);
    }
  }

  void _proceedToStep2() {
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final timeStr = '${_selectedTime.hour.toString().padLeft(2, '0')}:${_selectedTime.minute.toString().padLeft(2, '0')}';

    context.push(
      AppRoutes.tableSelection,
      extra: {
        'restaurant': _selectedRestaurant,
        'date': dateStr,
        'time': timeStr,
        'guests': _numberOfGuests,
        'step': 2,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const primaryColor = Color(0xFFB87F5C);

    return Scaffold(
      backgroundColor: const Color(0xFFFAF7F2),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Color(0xFF1E1E1E), size: 18),
          onPressed: () => context.pop(),
        ),
        centerTitle: true,
        title: const Text(
          'Reservation',
          style: TextStyle(
            fontFamily: 'Playfair Display',
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1E1E1E),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stepper Header: 1 Details -> 2 Select Table -> 3 Confirm
              const Text(
                'RESERVATION PROCESS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildStepItem(1, 'Details', isActive: true, isDone: false),
                  _buildStepLine(),
                  _buildStepItem(2, 'Select Table', isActive: false, isDone: false),
                  _buildStepLine(),
                  _buildStepItem(3, 'Confirm', isActive: false, isDone: false),
                ],
              ),
              const SizedBox(height: 36),

              // Section Title
              const Text(
                'RESERVATION DETAILS',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: Color(0xFF8C827A),
                ),
              ),
              const SizedBox(height: 16),

              // Restaurant Field
              _buildFieldCard(
                icon: Icons.home_outlined,
                title: 'Restaurant',
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedRestaurant,
                    isExpanded: true,
                    icon: const Icon(Icons.keyboard_arrow_down, color: Color(0xFF8C827A)),
                    items: _restaurants.map((r) {
                      return DropdownMenuItem(
                        value: r,
                        child: Text(
                          r,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E1E1E),
                          ),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _selectedRestaurant = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Date Field
              InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(16),
                child: _buildFieldCard(
                  icon: Icons.calendar_today_outlined,
                  title: 'Date',
                  trailingIcon: Icons.calendar_month_outlined,
                  child: Text(
                    DateFormat('EEE, d MMM yyyy').format(_selectedDate),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Time Field
              InkWell(
                onTap: _pickTime,
                borderRadius: BorderRadius.circular(16),
                child: _buildFieldCard(
                  icon: Icons.access_time_outlined,
                  title: 'Time',
                  trailingIcon: Icons.keyboard_arrow_down,
                  child: Text(
                    _selectedTime.format(context),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E1E1E),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Number of Guests Stepper
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEBE5DF)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3EDE7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.people_outline, color: primaryColor, size: 20),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Text(
                        'Number of Guests',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF8C827A),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        _buildCounterButton(
                          icon: Icons.remove,
                          onTap: () {
                            if (_numberOfGuests > 1) {
                              setState(() => _numberOfGuests--);
                            }
                          },
                        ),
                        Container(
                          constraints: const BoxConstraints(minWidth: 36),
                          alignment: Alignment.center,
                          child: Text(
                            '$_numberOfGuests',
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E1E1E),
                            ),
                          ),
                        ),
                        _buildCounterButton(
                          icon: Icons.add,
                          onTap: () {
                            if (_numberOfGuests < 20) {
                              setState(() => _numberOfGuests++);
                            }
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 40),

              // Next Button
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: _proceedToStep2,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Next',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Helpful Footer Note
              const Center(
                child: Text(
                  'Next ➔ Select Table screen\nFields remain editable before continuing',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFFA59D95),
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStepItem(int step, String label, {required bool isActive, required bool isDone}) {
    const primaryColor = Color(0xFFB87F5C);

    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isActive ? Colors.black : (isDone ? primaryColor : Colors.white),
            border: Border.all(
              color: isActive ? Colors.black : (isDone ? primaryColor : const Color(0xFFD4CDC5)),
              width: 1.5,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            '$step',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: isActive || isDone ? Colors.white : const Color(0xFF8C827A),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            color: isActive ? const Color(0xFF1E1E1E) : const Color(0xFF8C827A),
          ),
        ),
      ],
    );
  }

  Widget _buildStepLine() {
    return Expanded(
      child: Container(
        height: 1,
        margin: const EdgeInsets.only(bottom: 20, left: 8, right: 8),
        color: const Color(0xFFE5DDD5),
      ),
    );
  }

  Widget _buildFieldCard({
    required IconData icon,
    required String title,
    required Widget child,
    IconData? trailingIcon,
  }) {
    const primaryColor = Color(0xFFB87F5C);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEBE5DF)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF3EDE7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: primaryColor, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF8C827A),
                  ),
                ),
                const SizedBox(height: 2),
                child,
              ],
            ),
          ),
          if (trailingIcon != null)
            Icon(trailingIcon, color: const Color(0xFFB87F5C), size: 18),
        ],
      ),
    );
  }

  Widget _buildCounterButton({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F3EE),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE5DDD5)),
        ),
        child: Icon(icon, size: 16, color: const Color(0xFF1E1E1E)),
      ),
    );
  }
}
